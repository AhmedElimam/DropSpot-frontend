import { SheetModal } from '@/components/ui/SheetModal';
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useConfigRule } from '@/hooks/useAppConfig';
import { formatDate, formatDateTime, formatTime } from '@/utils/format';
import { useTranslation } from 'react-i18next';
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

type RecordFilter = 'all' | 'present' | 'absent' | 'excused';
const RECORD_LIMIT = 8;
const RECORD_FILTERS: { key: RecordFilter; label: string; match: (status: string | null | undefined) => boolean }[] = [
  { key: 'all', label: 'attendance.filter_all', match: () => true },
  { key: 'present', label: 'attendance.filter_present', match: (st) => st === 'present' || st === 'late' },
  { key: 'absent', label: 'attendance.filter_absent', match: (st) => st === 'absent' },
  { key: 'excused', label: 'attendance.filter_excused', match: (st) => st === 'excused' },
];

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
  const [filter, setFilter] = useState<RecordFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const allRecords = (records ?? []).filter(Boolean);
  const activeFilter = RECORD_FILTERS.find((f) => f.key === filter) ?? RECORD_FILTERS[0];
  const filteredRecords = filter === 'all' ? allRecords : allRecords.filter((r) => activeFilter.match(r.status));
  const visibleRecords = expanded ? filteredRecords : filteredRecords.slice(0, RECORD_LIMIT);
  // Rows grouped by month so a long record reads as a calendar, not a pile.
  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; rows: typeof visibleRecords }[] = [];
    for (const r of visibleRecords) {
      const d = r.session_time ? new Date(r.session_time) : null;
      const ok = d && !isNaN(d.getTime());
      const key = ok ? `${d.getFullYear()}-${d.getMonth()}` : 'unknown';
      const label = ok ? formatDate(d, { month: 'long', year: 'numeric' }) : '—';
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.rows.push(r); else groups.push({ key, label, rows: [r] });
    }
    return groups;
  }, [visibleRecords]);
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
          {/* PRIMARY: card scan at the door */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="card" size={28} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <SectionHead icon="card" color={colors.brand} title={t('attendance.card_primary_title')} />
                <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{t('attendance.card_primary_desc')}</Text>
              </View>
            </View>
            {user?.student_code ? (
              <View style={{ marginTop: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                <Text style={textPresets.caption}>{t('child_settings.student_code')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, letterSpacing: 2, marginTop: 2 }}>
                  {user.student_code}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Session picker */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <Text style={[textPresets.h3, { marginBottom: spacing.lg }]}>
              {t('attendance.select_session')}
            </Text>

            {sessionsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
            ) : todaySessions.length === 0 ? (
              <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }]}>
                {t('session.no_sessions')}
              </Text>
            ) : (
              todaySessions.map((session) => {
                const isSelected = selectedSession === session.id;
                const scheduled = new Date(session.scheduled_at);
                const endTime = new Date(scheduled.getTime() + session.duration_minutes * 60000);
                const timeStr = `${formatTime(scheduled)} - ${formatTime(endTime)}`;
                const { canCheckIn: inWindow } = getCheckInWindow(session.scheduled_at);
                const checkable = isCheckable(session);
                // The student's own outcome, else a finished session's lifecycle status.
                const badgeStatus = session.attendance_status
                  ?? (session.status !== 'scheduled' ? session.status : null);

                return (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => checkable && setSelectedSession(session.id)}
                    activeOpacity={checkable ? 0.7 : 1}
                    disabled={!checkable}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: isSelected ? colors.brandTint : colors.surfaceSunken,
                      marginBottom: spacing.sm,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.brand : colors.border,
                      opacity: checkable || badgeStatus ? 1 : 0.6,
                    }}
                  >
                    {checkable && (
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                        {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} />}
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.subtitle}>{session.course_name}</Text>
                      <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{session.teacher_name} · {timeStr}</Text>
                      {session.status === 'scheduled' && !inWindow && (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText, marginTop: 2 }}>
                          {t('attendance.outside_window')}
                        </Text>
                      )}
                      {session.status === 'scheduled' && (
                        session.phone_checkin_allowed ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Icon name="phone" size={12} color={colors.successText} />
                            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.successText }}>
                              {t('attendance.phone_allowed_badge')}
                            </Text>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Icon name="card" size={12} color={colors.textTertiary} outline />
                            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>
                              {t('attendance.card_only_badge')}
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                    {/* The student's outcome (present/late/absent/excused) or a finished
                        session's status; a live dot only while it's still checkable. */}
                    {badgeStatus ? (
                      <StatusBadge status={badgeStatus} size="sm" />
                    ) : checkable ? (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
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

          {/* Excuse for a recorded absence */}
          <TouchableOpacity
            onPress={() => { setExcuseVisible(true); setExcuseRecordId(null); setExcuseSent(false); setExcuseText(''); }}
            activeOpacity={0.8}
            style={{ borderRadius: radius.md, overflow: 'hidden' }}
          >
            <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.warning }}>
              <Icon name="note" size={20} color={colors.warningText} outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.warningText }}>{t('attendance.excuse')}</Text>
            </View>
          </TouchableOpacity>

          {/* Attendance at a glance: the rate as a ring with tinted counts. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <SectionHead icon="attendance" color={colors.success} title={t('attendance.coverage')} />
              <Text style={textPresets.caption}>{t('attendance.coverage_this_month')}</Text>
            </View>
            <AttendanceOverview present={stats?.present ?? 0} late={stats?.late ?? 0} absent={stats?.absent ?? 0} excused={stats?.excused ?? 0} />
          </View>

          {/* The record itself (founder 2026-10-03: «some love on the attendance record page»):
              filter chips with counts, then the sessions grouped by month as dated rows a
              student can dispute from. */}
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, ...shadows.sm, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
              <SectionHead icon="calendar" color={colors.brand} title={t('attendance.history_title')} />
              <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{t('attendance.history_sub')}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: spacing.md }}>
              {RECORD_FILTERS.map((f) => {
                const on = filter === f.key;
                const n = f.key === 'all' ? allRecords.length : allRecords.filter((r) => f.match(r.status)).length;
                const tone = f.key === 'present' ? colors.success : f.key === 'absent' ? colors.danger : f.key === 'excused' ? colors.info : colors.primary;
                return (
                  <TouchableOpacity key={f.key} onPress={() => { setFilter(f.key); setExpanded(false); }} activeOpacity={0.85} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={{ minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? tone : colors.surfaceSunken, borderWidth: 1, borderColor: on ? tone : colors.border }}>
                    {f.key !== 'all' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: on ? colors.onPrimary : tone }} /> : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? colors.onPrimary : colors.textSecondary }}>{t(f.label)}</Text>
                    <View style={{ minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.22)' : colors.surface }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: on ? colors.onPrimary : colors.textTertiary }}>{formatNumber(n)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ paddingHorizontal: spacing.lg }}>
              {visibleRecords.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
                  <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="calendar" size={22} color={colors.textTertiary} outline />
                  </View>
                  <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center' }]}>
                    {t(allRecords.length === 0 ? 'attendance.no_records' : 'attendance.no_records_filtered')}
                  </Text>
                </View>
              ) : monthGroups.map((g) => (
                <View key={g.key}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textTertiary }}>{g.label}</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: colors.borderLight }} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.textTertiary }}>{formatNumber(g.rows.length)}</Text>
                  </View>
                  {g.rows.map((record, i) => (
                    <AttendanceRecordRow
                      key={record.id || `${g.key}-${i}`}
                      record={record}
                      complaint={record.session_instance_id ? myComplaints.bySession.get(record.session_instance_id) : undefined}
                      onComplain={(r) => setComplaintTarget({ type: 'attendance', sessionInstanceId: r.session_instance_id, courseName: r.course_name ?? '', sessionAt: r.session_time ?? null, recordedStatus: r.status ?? null })}
                      last={i === g.rows.length - 1}
                    />
                  ))}
                </View>
              ))}
            </View>

            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
              {filteredRecords.length > RECORD_LIMIT ? (
                <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.85} accessibilityRole="button"
                  style={{ marginTop: spacing.sm, minHeight: 42, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                  <Icon name={expanded ? 'up' : 'down'} size={16} color={colors.brand} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>
                    {expanded ? t('attendance.show_less') : t('attendance.show_more', { count: formatNumber(filteredRecords.length - RECORD_LIMIT) })}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {allRecords.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
                  <Icon name="info" size={14} color={colors.textTertiary} outline />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('attendance.dispute_hint')}</Text>
                </View>
              ) : null}
            </View>
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
