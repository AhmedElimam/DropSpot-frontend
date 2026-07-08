import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useTodaySessions } from '@/hooks/useSessions';
import { useCheckIn, useCoverageStats, useAttendanceRecords, useSubmitExcuse } from '@/hooks/useAttendance';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/utils/format';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { SessionInstance } from '@/types/session-instance';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SuccessConfirmation } from '@/components/ui/SuccessConfirmation';
import { getFriendlyErrorMessage } from '@/utils/errors';

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
  const windowClose = new Date(start.getTime() + 15 * 60000);
  const opensIn = Math.ceil((windowOpen.getTime() - now.getTime()) / 60000);
  const closesIn = Math.ceil((windowClose.getTime() - now.getTime()) / 60000);
  return { canCheckIn: now >= windowOpen && now <= windowClose, opensIn, closesIn };
}

export default function CheckInTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: sessions, isLoading: sessionsLoading } = useTodaySessions();
  const { data: stats } = useCoverageStats();
  const { data: records } = useAttendanceRecords();
  const checkInMutation = useCheckIn();
  const submitExcuseMutation = useSubmitExcuse();

  const activeSessions = (sessions ?? []).filter((s) => s.status === 'scheduled');
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedInCourse, setCheckedInCourse] = useState('');
  const [excuseVisible, setExcuseVisible] = useState(false);
  const [excuseText, setExcuseText] = useState('');
  const [excuseRecordId, setExcuseRecordId] = useState<number | null>(null);
  const [excuseSent, setExcuseSent] = useState(false);

  // Location state
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isMocked, setIsMocked] = useState<boolean>(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const selectedSessionData = activeSessions.find((s) => s.id === selectedSession) ?? null;
  // Phone check-in is the exception, not the default: only when the teacher
  // granted permission or the course runs in pilot mode (no scanner yet).
  const phoneAllowed = selectedSessionData?.phone_checkin_allowed === true;

  useEffect(() => {
    // Only ask for location when phone check-in is actually available.
    if (!phoneAllowed) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        setLocationError(t('attendance.location_denied'));
        return;
      }
      setLocationPermission(true);

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (cancelled) return;
      if (loc.mocked) {
        setIsMocked(true);
        setLocationError(t('attendance.location_mocked'));
        return;
      }
      setUserLat(loc.coords.latitude);
      setUserLng(loc.coords.longitude);
      setUserAccuracy(loc.coords.accuracy ?? null);

      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 10000 },
        (update) => {
          if (update.mocked) {
            setIsMocked(true);
            setLocationError(t('attendance.location_mocked'));
            if (watchRef.current) watchRef.current.remove();
            return;
          }
          setUserLat(update.coords.latitude);
          setUserLng(update.coords.longitude);
          setUserAccuracy(update.coords.accuracy ?? null);
        }
      );
    })();

    return () => {
      cancelled = true;
      if (watchRef.current) watchRef.current.remove();
    };
  }, [phoneAllowed, t]);

  const proximity = useCallback((session: SessionInstance | null): { distance: number | null; withinRange: boolean; allowed: number } => {
    const allowed = (session?.radius_horizontal_meters ?? 20) + Math.min(userAccuracy ?? 50, 50);
    if (!userLat || !userLng || !session?.course_latitude || !session?.course_longitude) {
      return { distance: null, withinRange: false, allowed };
    }
    const d = haversineDistance(userLat, userLng, session.course_latitude, session.course_longitude);
    return { distance: Math.round(d), withinRange: d <= allowed, allowed };
  }, [userLat, userLng, userAccuracy]);

  const sessionProximity = selectedSessionData ? proximity(selectedSessionData) : { distance: null, withinRange: false, allowed: 50 };
  const sessionTimeInfo = selectedSessionData ? getCheckInWindow(selectedSessionData.scheduled_at) : null;
  const canCheckIn = !!selectedSessionData
    && phoneAllowed
    && locationPermission
    && !isMocked
    && sessionProximity.withinRange
    && (sessionTimeInfo?.canCheckIn ?? false)
    && !checkInMutation.isPending;

  const handleCheckIn = () => {
    if (!selectedSessionData || !userLat || !userLng) return;
    checkInMutation.mutate(
      {
        sessionInstanceId: selectedSessionData.id,
        latitude: userLat,
        longitude: userLng,
        accuracy: userAccuracy ?? undefined,
      },
      {
        onSuccess: () => {
          setCheckedIn(true);
          setCheckedInCourse(selectedSessionData.course_name ?? '');
        },
      }
    );
  };

  const absentRecords = (records ?? []).filter((r) => r?.status === 'absent').slice(0, 5);

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('attendance.check_in')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.md }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.white }}>{sessions?.length ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{t('session.today_sessions')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.white }}>{stats?.total ? Math.round(((stats.present + stats.late) / stats.total) * 100) : 0}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{t('attendance.coverage_rate')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.white }}>{stats?.absent ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          {/* PRIMARY: card scan at the door */}
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="card" size={28} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={textPresets.h3}>{t('attendance.card_primary_title')}</Text>
                <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{t('attendance.card_primary_desc')}</Text>
              </View>
            </View>
            {user?.student_code ? (
              <View style={{ marginTop: spacing.md, backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight }}>
                <Text style={textPresets.caption}>{t('child_settings.student_code')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary, letterSpacing: 2, marginTop: 2 }}>
                  {user.student_code}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Session picker */}
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <Text style={[textPresets.h3, { marginBottom: spacing.lg }]}>
              {t('attendance.select_session')}
            </Text>

            {sessionsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
            ) : activeSessions.length === 0 ? (
              <Text style={[textPresets.bodySmall, { color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }]}>
                {t('session.no_sessions')}
              </Text>
            ) : (
              activeSessions.map((session) => {
                const isSelected = selectedSession === session.id;
                const scheduled = new Date(session.scheduled_at);
                const endTime = new Date(scheduled.getTime() + session.duration_minutes * 60000);
                const timeStr = `${formatTime(scheduled)} - ${formatTime(endTime)}`;
                const { canCheckIn: inWindow } = getCheckInWindow(session.scheduled_at);

                return (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => setSelectedSession(session.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: isSelected ? colors.primaryLight : colors.background,
                      marginBottom: spacing.sm,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.primary : 'transparent',
                      opacity: inWindow ? 1 : 0.5,
                    }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSelected ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                      {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.subtitle}>{session.course_name}</Text>
                      <Text style={[textPresets.bodySmall, { marginTop: 2 }]}>{session.teacher_name} · {timeStr}</Text>
                      {!inWindow && (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.dangerText, marginTop: 2 }}>
                          {t('attendance.outside_window')}
                        </Text>
                      )}
                      {session.phone_checkin_allowed && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Icon name="phone" size={12} color={colors.successText} />
                          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.successText }}>
                            {t('attendance.phone_allowed_badge')}
                          </Text>
                        </View>
                      )}
                    </View>
                    {inWindow && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Phone check-in: only offered when permitted */}
          {selectedSessionData && !phoneAllowed && (
            <View style={{ backgroundColor: colors.infoLight, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <Icon name="info" size={22} color={colors.infoText} outline />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.infoText }}>
                {t('attendance.phone_not_allowed_hint')}
              </Text>
            </View>
          )}

          {selectedSessionData && phoneAllowed && (
            <>
              {selectedSessionData.checkin_permission_expires_at ? (
                <View style={{ backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="success" size={18} color={colors.successText} />
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.successText }}>
                    {t('attendance.phone_permission_until', {
                      time: new Date(selectedSessionData.checkin_permission_expires_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }),
                    })}
                  </Text>
                </View>
              ) : null}

              {/* Proximity status — the GPS check always applies */}
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={textPresets.bodySmall}>{t('attendance.proximity_status')}</Text>
                    {!locationPermission ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.dangerText, marginTop: 2 }}>
                        {locationError ?? t('attendance.location_denied')}
                      </Text>
                    ) : sessionProximity.distance === null ? (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>
                        {t('common.loading')}
                      </Text>
                    ) : (
                      <>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: sessionProximity.withinRange ? colors.successText : colors.dangerText, marginTop: 2 }}>
                          {sessionProximity.distance}m {t('attendance.from_class')}
                        </Text>
                        {sessionTimeInfo && (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                            {sessionTimeInfo.canCheckIn
                              ? t('attendance.window_open')
                              : sessionTimeInfo.opensIn > 0
                                ? t('attendance.window_opens_in', { minutes: sessionTimeInfo.opensIn })
                                : t('attendance.window_closed')}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                  <Icon
                    name={sessionProximity.withinRange ? 'success' : 'location'}
                    size={26}
                    color={sessionProximity.withinRange ? colors.success : colors.danger}
                  />
                </View>
                {/* Proximity bar — high-contrast solid colors for outdoor daylight */}
                {sessionProximity.distance !== null && (
                  <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.borderLight, marginTop: spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                    <View style={{
                      width: `${Math.min(100, (sessionProximity.distance / Math.max(sessionProximity.allowed, 1)) * 100)}%`,
                      height: '100%',
                      borderRadius: 5,
                      backgroundColor: sessionProximity.withinRange ? '#047857' : '#B91C1C',
                    }} />
                  </View>
                )}
              </View>

              {/* Server rejection surfaced clearly (e.g. permission granted but not at location) */}
              {checkInMutation.isError && (
                <View style={{ backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                  <Icon name="error" size={20} color={colors.dangerText} />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.dangerText }}>
                    {getFriendlyErrorMessage(checkInMutation.error)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={handleCheckIn}
                disabled={!canCheckIn}
                activeOpacity={0.85}
                style={{
                  borderRadius: radius.md,
                  overflow: 'hidden',
                  opacity: canCheckIn ? 1 : 0.4,
                }}
              >
                <LinearGradient
                  colors={canCheckIn ? gradients.primary : ['#94A3B8', '#94A3B8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.white, letterSpacing: 0.5 }}>
                    {checkInMutation.isPending
                      ? t('common.loading')
                      : !locationPermission
                        ? t('attendance.location_denied')
                        : isMocked
                          ? t('attendance.location_mocked')
                          : !sessionProximity.withinRange && sessionProximity.distance !== null
                            ? t('attendance.too_far')
                            : sessionTimeInfo && !sessionTimeInfo.canCheckIn
                              ? t('attendance.outside_window')
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

          {/* Attendance history */}
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={textPresets.h3}>{t('attendance.coverage')}</Text>
              <Text style={textPresets.bodySmall}>{t('attendance.coverage_this_month')}</Text>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.successText }}>{stats?.present ?? 0}</Text>
                <Text style={textPresets.caption}>{t('attendance.coverage_present')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.dangerText }}>{stats?.absent ?? 0}</Text>
                <Text style={textPresets.caption}>{t('attendance.coverage_absent')}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.infoLight, borderRadius: radius.md, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.infoText }}>{stats?.excused ?? 0}</Text>
                <Text style={textPresets.caption}>{t('attendance.coverage_excused')}</Text>
              </View>
            </View>

            {(records ?? []).slice(0, 10).map((record, i) => (
              <View key={record?.id ?? i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                <View>
                  <Text style={textPresets.body}>{record?.course_name}</Text>
                  <Text style={textPresets.caption}>
                    {record?.session_time ? new Date(record.session_time).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
                  </Text>
                </View>
                <StatusBadge status={record?.status ?? ''} size="sm" />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Excuse modal — pick which absence, then explain */}
      <Modal visible={excuseVisible} transparent animationType="slide" onRequestClose={() => setExcuseVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setExcuseVisible(false)} />
          <View style={{ backgroundColor: colors.white, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xxl, paddingBottom: spacing.xl5 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl }} />

            {excuseSent ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                  <Icon name="success" size={40} color={colors.success} />
                </View>
                <Text style={[textPresets.h3, { textAlign: 'center' }]}>{t('attendance.excuse_submitted')}</Text>
                <TouchableOpacity
                  onPress={() => setExcuseVisible(false)}
                  style={{ marginTop: spacing.xl, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xxxl, borderRadius: radius.md, backgroundColor: colors.primaryLight }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>{t('common.done')}</Text>
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
                          style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: isSel ? colors.primaryLight : colors.background, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: isSel ? colors.primary : 'transparent' }}
                        >
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSel ? colors.primary : colors.border, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                            {isSel && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={textPresets.body}>{record.course_name}</Text>
                            <Text style={textPresets.caption}>
                              {record.session_time ? new Date(record.session_time).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
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
          </View>
        </View>
      </Modal>
    </View>
  );
}
