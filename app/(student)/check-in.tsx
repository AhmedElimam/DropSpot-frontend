import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, layout } from '@/theme/index';
import { useTodaySessions } from '@/hooks/useSessions';
import { useCheckIn, useAttendanceRecords, useSubmitExcuse } from '@/hooks/useAttendance';
import { useStudentBillingStatus } from '@/hooks/useInvoices';
import { useAuthStore } from '@/stores/authStore';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { formatTime } from '@/utils/format';
import { toArabicDigits } from '@/utils/numerals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { SessionInstance } from '@/types/session-instance';
import { Icon, type IconName } from '@/components/ui/Icon';
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
  const windowClose = new Date(start.getTime() + 30 * 60000);
  const opensIn = Math.ceil((windowOpen.getTime() - now.getTime()) / 60000);
  const closesIn = Math.ceil((windowClose.getTime() - now.getTime()) / 60000);
  return { canCheckIn: now >= windowOpen && now <= windowClose, opensIn, closesIn };
}

/** One row in the "تفاصيل" card: wash icon tile + title + subtitle. */
function DetailRow({ icon, tone, title, subtitle, first }: { icon: IconName; tone: 'brand' | 'good' | 'danger'; title: string; subtitle?: string; first?: boolean }) {
  const bg = tone === 'good' ? colors.goodWash : tone === 'danger' ? colors.dangerWash : colors.brandWash;
  const fg = tone === 'good' ? colors.good : tone === 'danger' ? colors.danger : colors.brand;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={fg} outline={tone === 'brand'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export default function CheckInTab() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: sessions, isLoading: sessionsLoading, refetch: refetchSessions } = useTodaySessions();
  const { data: records, refetch: refetchRecords } = useAttendanceRecords();
  const { data: billingAlerts, refetch: refetchBilling } = useStudentBillingStatus();
  const checkInMutation = useCheckIn();
  const submitExcuseMutation = useSubmitExcuse();

  const todaySessions = sessions ?? [];
  const isCheckable = (s: SessionInstance) =>
    s.status === 'scheduled' && s.phone_checkin_allowed === true
    && getCheckInWindow(s.scheduled_at).canCheckIn && !s.checked_in;
  const checkableSessions = todaySessions.filter(isCheckable);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedInCourse, setCheckedInCourse] = useState('');
  const [excuseVisible, setExcuseVisible] = useState(false);
  const [excuseText, setExcuseText] = useState('');
  const [excuseRecordId, setExcuseRecordId] = useState<number | null>(null);
  const [excuseSent, setExcuseSent] = useState(false);

  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Eager location — read once on mount so the hero can show the live distance
  // ring. The check-in button still takes a FRESH fix on tap (accuracy at submit).
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number | null } | null>(null);
  const [locStatus, setLocStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  const readLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocStatus('denied'); return; }
      setLocStatus('granted');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy ?? null });
    } catch { setLocStatus('denied'); }
  }, []);
  useEffect(() => { readLocation(); }, [readLocation]);

  const { refreshing, onRefresh } = usePullRefresh(refetchSessions, refetchRecords, refetchBilling, readLocation);

  const selectedSessionData = checkableSessions.find((s) => s.id === selectedSession)
    ?? (checkableSessions.length >= 1 ? checkableSessions[0] : null);
  // Phone check-in path when a checkable session is selected; otherwise feature the
  // soonest scheduled session today (card path / out-of-window) for context.
  const phonePath = !!selectedSessionData;
  const featured = selectedSessionData
    ?? [...todaySessions].filter((s) => s.status === 'scheduled').sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0]
    ?? null;
  const sessionTimeInfo = featured ? getCheckInWindow(featured.scheduled_at) : null;
  const canTap = !!selectedSessionData && !checkInMutation.isPending && !locating;

  const GEOFENCE_MAX_ACCURACY = 50;
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

  const liveProx = phonePath && coords && selectedSessionData ? proximity(selectedSessionData, coords.lat, coords.lng, coords.acc) : null;

  // Ring status pill + distance.
  const ring = (() => {
    if (locStatus === 'denied') return { pill: t('attendance.enable_location'), live: false, distance: null as number | null };
    if (!coords) return { pill: t('attendance.locating'), live: false, distance: null };
    if (!liveProx || liveProx.distance === null) return { pill: t('attendance.no_anchor'), live: false, distance: null };
    return liveProx.withinRange
      ? { pill: t('attendance.in_range'), live: true, distance: liveProx.distance }
      : { pill: t('attendance.out_of_range'), live: false, distance: liveProx.distance };
  })();

  const handleCheckIn = async () => {
    if (!selectedSessionData) return;
    setLocationError(null);
    checkInMutation.reset();
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationError(t('attendance.location_denied')); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc.mocked) { setLocationError(t('attendance.location_mocked')); return; }
      const lat = loc.coords.latitude, lng = loc.coords.longitude, acc = loc.coords.accuracy ?? null;
      setCoords({ lat, lng, acc });
      const prox = proximity(selectedSessionData, lat, lng, acc);
      if (prox.distance !== null && !prox.withinRange) { setLocationError(t('attendance.too_far')); return; }
      if (sessionTimeInfo && !sessionTimeInfo.canCheckIn) { setLocationError(t('attendance.outside_window')); return; }
      checkInMutation.mutate(
        { sessionInstanceId: selectedSessionData.id, latitude: lat, longitude: lng, accuracy: acc ?? undefined },
        { onSuccess: () => { setCheckedIn(true); setCheckedInCourse(selectedSessionData.course_name ?? ''); } },
      );
    } catch {
      setLocationError(t('attendance.location_denied'));
    } finally {
      setLocating(false);
    }
  };

  const absentRecords = (records ?? []).filter((r) => r?.status === 'absent').slice(0, 5);
  const hasDues = (billingAlerts ?? []).length > 0;

  if (checkedIn) {
    return (
      <SuccessConfirmation
        title={t('attendance.check_in_success_title')}
        message={t('attendance.check_in_success_desc', { course: checkedInCourse })}
        doneLabel={t('common.done')}
        onDone={() => setCheckedIn(false)}
      />
    );
  }

  const goBack = () => { if (router.canGoBack()) router.back(); else router.navigate('/(student)'); };
  const meta = featured
    ? [`${formatTime(featured.scheduled_at)} — ${formatTime(new Date(new Date(featured.scheduled_at).getTime() + featured.duration_minutes * 60000))}${featured.location ? ` · ${featured.location}` : ''}`]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenPadding, paddingTop: insets.top + spacing.md, paddingBottom: layout.tabBottom + insets.bottom, gap: layout.sectionGap }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Header: back + centered title */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={goBack} style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="back" size={20} color={colors.ink} /></View>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>{t('attendance.check_in')}</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Multi-session selector (only when more than one is checkable now) */}
        {checkableSessions.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {checkableSessions.map((s) => {
              const on = selectedSessionData?.id === s.id;
              return (
                <TouchableOpacity key={s.id} onPress={() => setSelectedSession(s.id)} style={{ paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.chip, backgroundColor: on ? colors.brand : colors.surface, borderWidth: 1, borderColor: on ? colors.brand : colors.line }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: on ? '#fff' : colors.muted }}>{s.course_name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* HERO */}
        <LinearGradient colors={gradients.brandCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.hero, padding: spacing.xl, ...shadows.hero, overflow: 'hidden', alignItems: 'center' }}>
          <View pointerEvents="none" style={{ position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.07)', top: -100, left: -60 }} />

          {featured ? (
            <>
              {phonePath ? (
                <>
                  <View style={{ flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: spacing.md }}>
                    {ring.live ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#5BE9A6' }} /> : null}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#fff' }}>{ring.pill}</Text>
                  </View>
                  {/* Distance ring */}
                  <View style={{ width: 132, height: 132, borderRadius: 66, borderWidth: 5, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginVertical: 14 }}>
                    <View style={{ width: 104, height: 104, borderRadius: 52, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                      {ring.distance !== null ? (
                        <>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 27, color: '#fff', lineHeight: 30 }}>{toArabicDigits(ring.distance)}</Text>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{t('attendance.meters')}</Text>
                        </>
                      ) : (
                        <Icon name="gps" size={34} color="rgba(255,255,255,0.85)" />
                      )}
                    </View>
                  </View>
                </>
              ) : null}

              <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: '#fff', textAlign: 'center', lineHeight: 27 }}>
                {featured.course_name} — {featured.teacher_name}
              </Text>
              {meta[0] ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.87)', textAlign: 'center', marginTop: 5 }}>{meta[0]}</Text> : null}

              {phonePath ? (
                <TouchableOpacity onPress={handleCheckIn} disabled={!canTap} activeOpacity={0.9} style={{ alignSelf: 'stretch', marginTop: 18, height: 48, borderRadius: 15, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, opacity: canTap ? 1 : 0.6 }}>
                  {locating ? <ActivityIndicator color={colors.brand} /> : <Icon name="scan" size={18} color={colors.brand} />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.brand }}>
                    {locating ? t('attendance.getting_location') : checkInMutation.isPending ? t('common.loading') : t('attendance.check_in_now')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={{ alignSelf: 'stretch', marginTop: 16, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 15, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="card" size={18} color="#fff" />
                  <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('attendance.card_way_hint')}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <Icon name="calendar" size={40} color="rgba(255,255,255,0.85)" outline />
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: '#fff', marginTop: spacing.md }}>{t('session.no_sessions_today')}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Inline error (client geofence / permission / window / server) */}
        {(locationError || checkInMutation.isError) ? (
          <View style={{ backgroundColor: colors.dangerWash, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginTop: -spacing.sm }}>
            <Icon name="error" size={20} color={colors.danger} />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: colors.danger }}>
              {locationError ?? getFriendlyErrorMessage(checkInMutation.error)}
            </Text>
          </View>
        ) : null}

        {/* Can't attend? — swap to another slot or excuse a recorded absence */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={() => router.navigate((featured ? `/(student)/swap?sessionId=${featured.id}` : '/(student)/swap') as never)}
            activeOpacity={0.85}
            style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line }}
          >
            <Icon name="refresh" size={18} color={colors.brand} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('swap.entry')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setExcuseVisible(true); setExcuseRecordId(null); setExcuseSent(false); setExcuseText(''); }}
            activeOpacity={0.85}
            style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.warnWash, borderRadius: 15, borderWidth: 1, borderColor: colors.warn }}
          >
            <Icon name="note" size={18} color={colors.warn} outline />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warn }}>{t('attendance.excuse')}</Text>
          </TouchableOpacity>
        </View>

        {/* تفاصيل */}
        {featured ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginStart: 2 }}>{t('attendance.details')}</Text>
            <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, ...shadows.sm, paddingHorizontal: spacing.lg }}>
              <DetailRow
                first
                icon={sessionTimeInfo?.canCheckIn ? 'success' : 'clock'}
                tone={sessionTimeInfo?.canCheckIn ? 'good' : 'brand'}
                title={sessionTimeInfo?.canCheckIn ? t('attendance.window_open') : t('attendance.window_closed')}
                subtitle={
                  sessionTimeInfo
                    ? (sessionTimeInfo.canCheckIn
                        ? t('attendance.window_remaining', { count: Math.max(0, sessionTimeInfo.closesIn) })
                        : (sessionTimeInfo.opensIn > 0 ? t('attendance.window_opens_in', { minutes: toArabicDigits(sessionTimeInfo.opensIn) }) : t('attendance.window_over')))
                    : undefined
                }
              />
              {phonePath ? (
                <DetailRow
                  icon="location"
                  tone={ring.live ? 'good' : 'brand'}
                  title={ring.live ? t('attendance.location_confirmed') : t('attendance.location_pending')}
                  subtitle={liveProx && liveProx.distance !== null && coords
                    ? `${t('attendance.signal_accuracy', { count: Math.round(coords.acc ?? 0) })} · ${t('attendance.within_range_of', { count: Math.round(liveProx.allowed) })}`
                    : ring.pill}
                />
              ) : null}
              <DetailRow
                icon={hasDues ? 'warning' : 'success'}
                tone={hasDues ? 'danger' : 'good'}
                title={hasDues ? t('attendance.dues_block_title') : t('attendance.no_dues_title')}
                subtitle={hasDues ? t('attendance.dues_block_desc') : t('attendance.no_dues_desc')}
              />
            </View>
          </View>
        ) : null}

        {/* طرق أخرى — the physical card at the door (the primary door method) */}
        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginStart: 2 }}>{t('attendance.other_methods')}</Text>
          <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, ...shadows.sm, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandWash, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="card" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{t('attendance.card_primary_title')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('attendance.card_primary_desc')}</Text>
            </View>
            {user?.student_code ? (
              <View style={{ backgroundColor: colors.brandWash, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand, letterSpacing: 1 }}>{user.student_code}</Text>
              </View>
            ) : null}
          </View>
        </View>

      </ScrollView>

      {/* Excuse modal */}
      <Modal visible={excuseVisible} transparent animationType="slide" onRequestClose={() => setExcuseVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setExcuseVisible(false)} />
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: spacing.xxl, paddingBottom: spacing.xl5 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: spacing.xl }} />

            {excuseSent ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.goodWash, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                  <Icon name="success" size={40} color={colors.good} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'center' }}>{t('attendance.excuse_submitted')}</Text>
                <TouchableOpacity onPress={() => setExcuseVisible(false)} style={{ marginTop: spacing.xl, minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.xxxl, borderRadius: radius.md, backgroundColor: colors.brandWash }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.brand }}>{t('common.done')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.ink }}>{t('attendance.excuse_title')}</Text>
                {absentRecords.length === 0 ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.muted, paddingVertical: spacing.xl, textAlign: 'center' }}>
                    {t('attendance.no_absences_to_excuse')}
                  </Text>
                ) : (
                  <>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: spacing.md, marginBottom: spacing.sm }}>
                      {t('attendance.excuse_select_session')}
                    </Text>
                    {absentRecords.map((record) => {
                      const isSel = excuseRecordId === record.id;
                      return (
                        <TouchableOpacity key={record.id} onPress={() => setExcuseRecordId(record.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: isSel ? colors.brandWash : colors.surfaceSunken, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: isSel ? colors.brand : colors.line }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: isSel ? colors.brand : colors.borderStrong, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                            {isSel && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand }} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{record.course_name}</Text>
                            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted }}>
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
                      placeholderTextColor={colors.faint}
                      multiline
                      numberOfLines={4}
                      style={{ fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg, color: colors.ink, textAlign: 'right', minHeight: 100, borderWidth: 1, borderColor: colors.line }}
                    />
                    {submitExcuseMutation.isError && (
                      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.danger, marginBottom: spacing.md }}>
                        {getFriendlyErrorMessage(submitExcuseMutation.error)}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        if (!excuseText.trim() || !excuseRecordId) return;
                        submitExcuseMutation.mutate(
                          { attendanceRecordId: excuseRecordId, reason: excuseText },
                          { onSuccess: () => { setExcuseSent(true); setExcuseText(''); } },
                        );
                      }}
                      disabled={!excuseText.trim() || !excuseRecordId || submitExcuseMutation.isPending}
                      activeOpacity={0.85}
                      style={{ minHeight: 52, borderRadius: radius.md, backgroundColor: colors.warn, alignItems: 'center', justifyContent: 'center', opacity: (!excuseText.trim() || !excuseRecordId || submitExcuseMutation.isPending) ? 0.5 : 1 }}
                    >
                      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>
                        {submitExcuseMutation.isPending ? t('common.loading') : t('attendance.excuse_submit')}
                      </Text>
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
