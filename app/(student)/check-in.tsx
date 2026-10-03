import { SheetModal } from '@/components/ui/SheetModal';
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useConfigRule } from '@/hooks/useAppConfig';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useTodaySessions } from '@/hooks/useSessions';
import { useCheckIn, useCoverageStats, useAttendanceRecords, useSubmitExcuse } from '@/hooks/useAttendance';
import { useAuthStore } from '@/stores/authStore';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { SessionInstance } from '@/types/session-instance';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SuccessConfirmation } from '@/components/ui/SuccessConfirmation';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { PageHero } from '@/components/ui/PageHero';
import { SectionHead } from '@/components/ui/SectionHead';
import { formatNumber } from '@/utils/format';
import { ComplaintSheet, type ComplaintTarget } from '@/components/student/ComplaintSheet';
import { useMyComplaints } from '@/hooks/useComplaints';
import { AttendanceOverview } from '@/components/attendance/AttendanceOverview';
import { AttendanceRecordRow } from '@/components/attendance/AttendanceRecordRow';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getCheckInWindow(scheduledAt: string): { canCheckIn: boolean; opensIn: number; closesIn: number } {
  const now = new Date();
  const start = new Date(scheduledAt);
  const windowOpen = new Date(start.getTime() - 10 * 60000);
  const windowClose = new Date(start.getTime() + 30 * 60000);
  const opensIn = Math.ceil((windowOpen.getTime() - now.getTime()) / 60000);
  const closesIn = Math.ceil((windowClose.getTime() - now.getTime()) / 60000);
  return { canCheckIn: now >= windowOpen && now <= windowClose, opensIn, closesIn };
}

export default function CheckInTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useTodaySessions();
  const { data: stats, refetch: refetchStats } = useCoverageStats();
  const { data: records, refetch: refetchRecords } = useAttendanceRecords();
  const { refreshing, onRefresh } = usePullRefresh(refetchSessions, refetchStats, refetchRecords);
  const checkInMutation = useCheckIn();
  const submitExcuseMutation = useSubmitExcuse();

  const todaySessions = sessions ?? [];
  // Phone check-in is offered only when the session is still scheduled, phone check-in
  // is permitted for it, the window is open, and the student hasn't already checked in.
  const isCheckable = (s: SessionInstance) =>
    s.status === 'scheduled' && s.phone_checkin_allowed === true
    && getCheckInWindow(s.scheduled_at).canCheckIn && !s.checked_in;
  const checkableSessions = todaySessions.filter(isCheckable);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedInCourse, setCheckedInCourse] = useState('');
  const [excuseVisible, setExcuseVisible] = useState(false);
  const [complaintTarget, setComplaintTarget] = useState<ComplaintTarget | null>(null);
  const myComplaints = useMyComplaints();
  const recentRecords = (records ?? []).filter(Boolean).slice(0, 5);
  const [excuseText, setExcuseText] = useState('');
  const [excuseRecordId, setExcuseRecordId] = useState<number | null>(null);
  const [excuseSent, setExcuseSent] = useState(false);

  // Location is requested ON CHECK-IN (on tap), not eagerly — the geofence only
  // runs when the student actually taps the button.
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Only a checkable session can be selected, so the check-in button never appears
  // for a completed / outside-window / card-only session. Auto-select the sole one.
  const selectedSessionData = checkableSessions.find((s) => s.id === selectedSession)
    ?? (checkableSessions.length === 1 ? checkableSessions[0] : null);
  const phoneAllowed = selectedSessionData?.phone_checkin_allowed === true;

  const sessionTimeInfo = selectedSessionData ? getCheckInWindow(selectedSessionData.scheduled_at) : null;
  // The button shows/enabled by default once there's a session; ALL validation
  // (phone-permission, time window, geofence) happens on tap.
  const canTap = !!selectedSessionData && !checkInMutation.isPending && !locating;

  // Mirror the server geofence EXACTLY (AttendanceService::validateGeofence):
  //   allowed = radius + min(reading accuracy, MAX) + min(anchor accuracy, MAX)
  // The anchor term matters most for a low-confidence anchor (e.g. one set from a
  // laptop indoors). Omitting it — as this used to — made the client stricter than
  // the server, so it rejected check-ins the server would have accepted ("too far"
  // while standing at the classroom). MAX is now served from /app-config
  // (geofence_max_accuracy_m) — one source, so client & server can't drift; the
  // bundled default (50) is the fallback when config hasn't loaded.
  const GEOFENCE_MAX_ACCURACY = useConfigRule('geofence_max_accuracy_m');
  function proximity(session: SessionInstance, lat: number, lng: number, acc: number | null) {
    const readingAllowance = Math.min(acc ?? GEOFENCE_MAX_ACCURACY, GEOFENCE_MAX_ACCURACY);
    const anchorAllowance = Math.min(Math.max(0, session.location_accuracy_meters ?? 0), GEOFENCE_MAX_ACCURACY);
    const allowed = (session.radius_horizontal_meters ?? 20) + readingAllowance + anchorAllowance;
    if (!session.course_latitude || !session.course_longitude) {
      return { distance: null as number | null, withinRange: false, allowed };
    }
    const d = haversineDistance(lat, lng, session.course_latitude, session.course_longitude);
    return { distance: Math.round(d), withinRange: d <= allowed, allowed };
  }

  // Tap → request permission → get GPS → validate geofence → submit.
  const handleCheckIn = async () => {
    if (!selectedSessionData) return;
    setLocationError(null);
    checkInMutation.reset();
    setLocating(true);
    try {
      // 1) Location permission FIRST — this is the prompt the student expects on
      //    tap. (The server still enforces whether phone check-in is permitted, so
      //    we don't short-circuit on it here.)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError(t('attendance.location_denied')); return; }

      // 2) GPS fix (reject spoofed location).
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc.mocked) { setLocationError(t('attendance.location_mocked')); return; }

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const acc = loc.coords.accuracy ?? null;

      // 3) Geofence — only when the course has an anchor; otherwise let the server
      //    decide (a course with no location can't be validated client-side).
      const prox = proximity(selectedSessionData, lat, lng, acc);
      if (prox.distance !== null && !prox.withinRange) {
        setLocationError(t('attendance.too_far'));
        return;
      }

      // 4) Time window (client hint; the server enforces it too).
      if (sessionTimeInfo && !sessionTimeInfo.canCheckIn) {
        setLocationError(t('attendance.outside_window'));
        return;
      }

      // 5) Submit — the server is the source of truth for permission/window/geofence.
      checkInMutation.mutate(
        { sessionInstanceId: selectedSessionData.id, latitude: lat, longitude: lng, accuracy: acc ?? undefined },
        {
          onSuccess: () => {
            setCheckedIn(true);
            setCheckedInCourse(selectedSessionData.course_name ?? '');
          },
        }
      );
    } catch {
      setLocationError(t('attendance.location_denied'));
    } finally {
      setLocating(false);
    }
  };

  // Only absences that can still be excused — the window closes once the course's
  // next session begins (server-authoritative via `can_excuse`; `!== false` keeps
  // older API responses that omit the field working).
  const absentRecords = (records ?? [])
    .filter((r) => r?.status === 'absent' && r?.can_excuse !== false)
    .slice(0, 5);

  if (checkedIn) {
    return (
      <SuccessConfirmation
        title={t('attendance.check_in_success_title')}
        message={t('attendance.check_in_success_desc', { course: checkedInCourse })}
        doneLabel={t('common.back')}
        onDone={() => setCheckedIn(false)}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom, backgroundColor: colors.background, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <PageHero
          title={t('attendance.check_in')}
          subtitle={formatDate(new Date())}
          stats={[
            { value: formatNumber(sessions?.length ?? 0), label: t('session.today_sessions') },
            { value: `${formatNumber(stats?.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0)}%`, label: t('attendance.coverage_rate') },
            { value: formatNumber(stats?.absent ?? 0), label: t('attendance.absent'), warn: (stats?.absent ?? 0) > 0 },
          ]}
        />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          {/* PRIMARY: the card at the door — one compact strip, code as a chip (founder 2026-10-03:
              the tab needed «love»; the old block gave the code half a screen). */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="card" size={24} color={colors.brand} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{t('attendance.card_primary_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={2}>{t('attendance.card_primary_desc')}</Text>
            </View>
            {user?.student_code ? (
              <View style={{ alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, paddingHorizontal: spacing.sm }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.textTertiary }}>{t('child_settings.student_code')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, letterSpacing: 1 }} numberOfLines={1}>{user.student_code}</Text>
              </View>
            ) : null}
          </View>

          {/* Today's sessions — pick the one to check into. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <SectionHead icon="sessions" color={colors.brand} title={t('session.today_sessions')} />
              {todaySessions.length > 0 ? (
                <Text style={textPresets.caption}>{checkableSessions.length > 0 ? t('attendance.select_session') : ''}</Text>
              ) : null}
            </View>

            {sessionsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
            ) : todaySessions.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="calendar" size={20} color={colors.textTertiary} outline />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('session.no_sessions')}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>{t('attendance.no_sessions_hint')}</Text>
                </View>
              </View>
            ) : (
              todaySessions.map((session, i) => {
                const isSelected = selectedSession === session.id;
                const scheduled = new Date(session.scheduled_at);
                const endTime = new Date(scheduled.getTime() + session.duration_minutes * 60000);
                const { canCheckIn: inWindow } = getCheckInWindow(session.scheduled_at);
                const checkable = isCheckable(session);
                // The student's own outcome, else a finished session's lifecycle status.
                const badgeStatus = session.attendance_status
                  ?? (session.status !== 'scheduled' ? session.status : null);
                const tone = isSelected ? colors.brand : checkable ? colors.success : colors.borderStrong;

                return (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => checkable && setSelectedSession(session.id)}
                    activeOpacity={checkable ? 0.7 : 1}
                    disabled={!checkable}
                    accessibilityRole={checkable ? 'radio' : undefined}
                    accessibilityState={checkable ? { selected: isSelected } : undefined}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                      padding: spacing.md, borderRadius: radius.lg,
                      backgroundColor: isSelected ? colors.brandTint : colors.surfaceSunken,
                      borderWidth: 1.5, borderColor: isSelected ? colors.brand : colors.border,
                      borderStartWidth: 4, borderStartColor: tone,
                      marginBottom: i < todaySessions.length - 1 ? spacing.sm : 0,
                      opacity: checkable || badgeStatus ? 1 : 0.65,
                    }}
                  >
                    <View style={{ width: 56, alignItems: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: isSelected ? colors.brand : colors.textPrimary }} numberOfLines={1} adjustsFontSizeToFit>{formatTime(scheduled)}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.textTertiary }} numberOfLines={1} adjustsFontSizeToFit>{formatTime(endTime)}</Text>
                    </View>
                    <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: colors.borderLight }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{session.course_name}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{session.teacher_name}</Text>
                      {session.status === 'scheduled' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <Icon name={session.phone_checkin_allowed ? 'phone' : 'card'} size={12} color={session.phone_checkin_allowed ? colors.successText : colors.textTertiary} outline={!session.phone_checkin_allowed} />
                          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: session.phone_checkin_allowed ? colors.successText : colors.textTertiary }}>
                            {session.phone_checkin_allowed ? t('attendance.phone_allowed_badge') : t('attendance.card_only_badge')}
                          </Text>
                          {!inWindow ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText }}> · {t('attendance.outside_window')}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                    {badgeStatus ? (
                      <StatusBadge status={badgeStatus} size="sm" />
                    ) : checkable ? (
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center' }}>
                        {isSelected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Check-in button shows BY DEFAULT once a session is selected. Whether
              phone check-in is permitted, the window is open, and the student is
              at the classroom are all validated on tap. */}
          {selectedSessionData && (
            <>
              {phoneAllowed && selectedSessionData.checkin_permission_expires_at ? (
                <View style={{ backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="success" size={18} color={colors.successText} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.successText }}>
                    {t('attendance.phone_permission_until', {
                      time: formatDateTime(selectedSessionData.checkin_permission_expires_at, { hour: '2-digit' }),
                    })}
                  </Text>
                </View>
              ) : null}

              {/* Hint: geofence-on-tap when phone check-in is on; else use the card */}
              <View style={{ backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <Icon name={phoneAllowed ? 'location' : 'info'} size={18} color={colors.infoText} outline />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.infoText }}>
                  {phoneAllowed ? t('attendance.location_checked_on_tap') : t('attendance.phone_not_allowed_hint')}
                </Text>
              </View>

              {/* Errors: client geofence/permission/window OR server rejection */}
              {(locationError || checkInMutation.isError) && (
                <View style={{ backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <Icon name="error" size={20} color={colors.dangerText} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.dangerText }}>
                    {locationError ?? getFriendlyErrorMessage(checkInMutation.error)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleCheckIn}
                disabled={!canTap}
                activeOpacity={0.85}
                style={{ borderRadius: radius.md, overflow: 'hidden', opacity: canTap ? 1 : 0.4 }}
              >
                <LinearGradient
                  colors={canTap ? gradients.primary : [colors.textTertiary, colors.textTertiary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}
                >
                  {locating ? <ActivityIndicator color={colors.white} /> : null}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.white, letterSpacing: 0.5 }}>
                    {locating
                      ? t('attendance.getting_location')
                      : checkInMutation.isPending
                        ? t('common.loading')
                        : t('attendance.check_in_now')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {/* Excuse for a recorded absence — a row that says what it is for, not a loud button. */}
          <TouchableOpacity
            onPress={() => { setExcuseVisible(true); setExcuseRecordId(null); setExcuseSent(false); setExcuseText(''); }}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: colors.warning, ...shadows.sm }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="note" size={22} color={colors.warningText} outline />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('attendance.excuse')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{t('attendance.excuse_sub')}</Text>
            </View>
            {absentRecords.length > 0 ? (
              <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onPrimary }}>{formatNumber(absentRecords.length)}</Text>
              </View>
            ) : null}
            <Icon name="back" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Attendance at a glance — tap for the full record, course by course. */}
          <TouchableOpacity onPress={() => router.push('/(student)/attendance')} activeOpacity={0.85} accessibilityRole="button" accessibilityHint={t('attendance.tap_for_detail')}
            style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <SectionHead icon="attendance" color={colors.success} title={t('attendance.coverage')} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('attendance.tap_for_detail')}</Text>
                <Icon name="back" size={14} color={colors.brand} />
              </View>
            </View>
            <AttendanceOverview present={stats?.present ?? 0} late={stats?.late ?? 0} absent={stats?.absent ?? 0} excused={stats?.excused ?? 0} />
          </TouchableOpacity>

          {/* The last five sessions; the whole record lives on its own page. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <SectionHead icon="calendar" color={colors.brand} title={t('attendance.recent_title')} />
            <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{t('attendance.recent_sub')}</Text>
            <View style={{ marginTop: spacing.xs }}>
              {recentRecords.length === 0 ? (
                <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }]}>{t('attendance.no_records')}</Text>
              ) : recentRecords.map((record, i) => (
                <AttendanceRecordRow
                  key={record.id || i}
                  record={record}
                  complaint={record.session_instance_id ? myComplaints.bySession.get(record.session_instance_id) : undefined}
                  onComplain={(r) => setComplaintTarget({ type: 'attendance', sessionInstanceId: r.session_instance_id, courseName: r.course_name ?? '', sessionAt: r.session_time ?? null, recordedStatus: r.status ?? null })}
                  last={i === recentRecords.length - 1}
                />
              ))}
            </View>
            {(records ?? []).length > 0 ? (
              <TouchableOpacity onPress={() => router.push('/(student)/attendance')} activeOpacity={0.85} accessibilityRole="button"
                style={{ marginTop: spacing.md, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                <Icon name="calendar" size={16} color={colors.brand} outline />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.brand }}>{t('attendance.open_detail')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <ComplaintSheet visible={!!complaintTarget} onClose={() => setComplaintTarget(null)} target={complaintTarget} />

      {/* Excuse modal — pick which absence, then explain */}
      <SheetModal visible={excuseVisible} onClose={() => setExcuseVisible(false)} avoidKeyboard style={{ backgroundColor: colors.surface, maxHeight: '85%' }}>
            {/* The sheet itself is the only way out (handle, swipe, dim, back) — a close
                button and a second handle here made it dismiss three ways at once. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.lg }}
            >

            {excuseSent ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                  <Icon name="success" size={40} color={colors.success} />
                </View>
                <Text style={[textPresets.h3, { textAlign: 'center' }]}>{t('attendance.excuse_submitted')}</Text>
                <TouchableOpacity
                  onPress={() => setExcuseVisible(false)}
                  style={{ marginTop: spacing.xl, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xxxl, borderRadius: radius.md, backgroundColor: colors.brandTint }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={textPresets.h2}>{t('attendance.excuse_title')}</Text>

                {absentRecords.length === 0 ? (
                  <Text style={[textPresets.body, { color: colors.textSecondary, paddingVertical: spacing.xl, textAlign: 'center' }]}>
                    {t('attendance.no_absences_to_excuse')}
                  </Text>
                ) : (
                  <>
                    <Text style={[textPresets.label, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
                      {t('attendance.excuse_select_session')}
                    </Text>
                    {absentRecords.map((record) => {
                      const isSel = excuseRecordId === record.id;
                      return (
                        <TouchableOpacity
                          key={record.id}
                          onPress={() => setExcuseRecordId(record.id)}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: isSel ? colors.brandTint : colors.surfaceSunken, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: isSel ? colors.brand : colors.border }}
                        >
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSel ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                            {isSel && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={textPresets.body}>{record.course_name}</Text>
                            <Text style={textPresets.caption}>
                              {record.session_time ? formatDate(record.session_time) : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <TextInput
                      value={excuseText}
                      onChangeText={setExcuseText}
                      placeholder={t('attendance.excuse_placeholder')}
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={4}
                      style={{ fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, color: colors.textPrimary, textAlign: 'right', minHeight: 100, borderWidth: 1, borderColor: colors.border }}
                    />

                    {submitExcuseMutation.isError && (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.dangerText, marginBottom: spacing.md }}>
                        {getFriendlyErrorMessage(submitExcuseMutation.error)}
                      </Text>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        if (!excuseText.trim() || !excuseRecordId) return;
                        submitExcuseMutation.mutate(
                          { attendanceRecordId: excuseRecordId, reason: excuseText },
                          { onSuccess: () => { setExcuseSent(true); setExcuseText(''); } }
                        );
                      }}
                      disabled={!excuseText.trim() || !excuseRecordId || submitExcuseMutation.isPending}
                      activeOpacity={0.85}
                      style={{ borderRadius: radius.md, overflow: 'hidden', opacity: (!excuseText.trim() || !excuseRecordId || submitExcuseMutation.isPending) ? 0.5 : 1 }}
                    >
                      <LinearGradient colors={gradients.warm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>
                          {submitExcuseMutation.isPending ? t('common.loading') : t('attendance.excuse_submit')}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
            </ScrollView>
      </SheetModal>
    </View>
  );
}
