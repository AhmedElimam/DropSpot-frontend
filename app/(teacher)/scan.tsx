import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Vibration, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { scanCard, getMyTeachers, type ScanResult } from '@/api/teacher';
import { scanRevision, addRevisionGuest, addRevisionGuestByPhone } from '@/api/revisions';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import { bufferScan, deleteScan } from '@/db/offlineScans';
import { useOfflineStore } from '@/stores/offlineStore';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { Icon } from '@/components/ui/Icon';

const COOLDOWN_MS = 2500; // ignore repeat reads of the same card
const FEEDBACK_MS = 1600; // how long the green/red result stays before resuming

export default function TeacherScan() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    name?: string; id?: string;
    revisionId?: string; revisionInstanceId?: string; revisionTitle?: string; billingMode?: string;
  }>();
  const { data: sessions } = useTeacherTodaySessions();
  const online = useOfflineStore((s) => s.online);

  // ---- Revision mode (from the picker) — scan into a specific revision session.
  // Online-only: no offline buffering (guest creation / SMS / spread split can't
  // reconcile from a buffer). Absent params → normal attendance, unchanged.
  const revisionMode = !!params.revisionId && !!params.revisionInstanceId;
  const revisionId = params.revisionId ? Number(params.revisionId) : null;
  const revisionInstanceId = params.revisionInstanceId ? Number(params.revisionInstanceId) : null;
  const isSpread = params.billingMode === 'spread';

  const currentSessions = (sessions ?? []).filter((s) => s.is_current);
  const sessionName = params.name || (currentSessions.length === 1 ? currentSessions[0].course_name ?? '' : '');

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [feedback, setFeedback] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  // Off-roster guest prompt (revision mode) + the add-by-phone form.
  const [guestPrompt, setGuestPrompt] = useState<{ id: number; name: string } | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gErr, setGErr] = useState('');
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  useEffect(() => {
    const { role, activeTeacherId, setActiveTeacherId } = useAuthStore.getState();
    if (role === 'assistant' && activeTeacherId == null) {
      getMyTeachers()
        .then((res) => { if (res.active_teacher_id != null) setActiveTeacherId(res.active_teacher_id); })
        .catch(() => {});
    }
  }, []);

  const flash = useCallback((success: boolean, message: string, studentName?: string | null) => {
    Vibration.vibrate(success ? 60 : [0, 120, 90, 120]);
    setFeedback({ success, message, student_name: studentName ?? null });
    setTimeout(() => { setFeedback(null); setBusy(false); }, FEEDBACK_MS);
  }, []);

  const paused = !!feedback || busy || !!guestPrompt || phoneOpen;

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (paused) return;
      if (data === lastRef.current.code && now - lastRef.current.at < COOLDOWN_MS) return;
      lastRef.current = { code: data, at: now };
      setBusy(true);

      // ---- Revision mode: online-only, no offline buffer. ----
      if (revisionMode && revisionId != null && revisionInstanceId != null) {
        try {
          const res = await scanRevision(revisionId, revisionInstanceId, data);
          if (!res.success && res.code === 'NOT_ON_ROSTER' && res.student) {
            setBusy(false);
            setGuestPrompt(res.student); // hold for the teacher's decision
            return;
          }
          flash(res.success, res.message || (res.success ? t('teacher.checked_in') : t('teacher.scan_failed')), res.student_name);
        } catch {
          flash(false, t('teacher.scan_failed'));
        }
        return;
      }

      // ---- Regular attendance: buffer offline first, then sync (unchanged). ----
      const scannedAt = new Date().toISOString();
      const teacherId = stampTeacherId(useAuthStore.getState());
      let localId: number | null = null;
      try {
        localId = await bufferScan(data, scannedAt, teacherId);
        await useOfflineStore.getState().refresh();
      } catch { /* fall through to live path */ }

      try {
        const res = await scanCard(data);
        if (localId !== null) {
          await deleteScan(localId);
          await useOfflineStore.getState().refresh();
        }
        flash(res.success, res.message || (res.success ? t('teacher.checked_in') : t('teacher.scan_failed')), res.student_name);
      } catch {
        Vibration.vibrate(40);
        setFeedback({ success: true, message: t('teacher.saved_offline'), student_name: null });
        setTimeout(() => { setFeedback(null); setBusy(false); }, FEEDBACK_MS);
      }
    },
    [paused, revisionMode, revisionId, revisionInstanceId, flash, t],
  );

  const confirmGuest = useCallback(async () => {
    if (!guestPrompt || revisionId == null || revisionInstanceId == null) return;
    setBusy(true);
    const student = guestPrompt;
    setGuestPrompt(null);
    const res = await addRevisionGuest(revisionId, revisionInstanceId, student.id);
    flash(res.success, res.message || t('teacher.guest_added'), res.student_name ?? student.name);
  }, [guestPrompt, revisionId, revisionInstanceId, flash, t]);

  const submitPhone = useCallback(async () => {
    if (revisionId == null || revisionInstanceId == null) return;
    const name = gName.trim();
    const phone = gPhone.trim();
    if (name.length < 2) { setGErr(t('teacher.guest_name')); return; }
    if (phone.length < 6) { setGErr(t('teacher.guest_phone_ph')); return; }
    setGErr('');
    setBusy(true);
    const res = await addRevisionGuestByPhone(revisionId, revisionInstanceId, name, phone);
    if (res.success) {
      setPhoneOpen(false); setGName(''); setGPhone('');
      flash(true, res.message || t('teacher.guest_added'), res.student_name ?? name);
    } else {
      setBusy(false);
      setGErr(res.message || t('teacher.scan_failed'));
    }
  }, [revisionId, revisionInstanceId, gName, gPhone, flash, t]);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Icon name="scan" size={56} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }}>
          {t('teacher.camera_permission_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
          {t('teacher.camera_permission_body')}
        </Text>
        <TouchableOpacity onPress={requestPermission} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('teacher.grant_camera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'codabar', 'itf14'] }}
        onBarcodeScanned={paused ? undefined : handleScan}
      />

      {/* Header: session / revision context */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: revisionMode ? 'rgba(76,29,149,0.82)' : 'rgba(23,28,59,0.72)', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity
          onPress={() => (revisionMode ? router.replace('/(teacher)/revisions' as Href) : router.replace('/(teacher)'))}
          accessibilityRole="button"
          accessibilityLabel={t('teacher.switch_session')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}
        >
          <Icon name="forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            {revisionMode ? t('teacher.revision_scanning_for') : t('teacher.scanning_for')}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }} numberOfLines={1}>
            {revisionMode ? (params.revisionTitle || t('teacher.revisions_title')) : (sessionName || t('teacher.scan_mode'))}
          </Text>
          {!revisionMode && !online ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.warning }} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.warningLight }}>{t('teacher.offline_saving_local')}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setTorch((v) => !v)} accessibilityRole="button" accessibilityLabel={t('teacher.torch')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: torch ? colors.accentWarm : 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="eye" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Scan frame + hint */}
      {!feedback && !guestPrompt && !phoneOpen && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 260, height: 170, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 20 }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#fff', marginTop: spacing.lg, textAlign: 'center', paddingHorizontal: spacing.xl }}>
            {busy ? t('teacher.checking') : t('teacher.point_camera')}
          </Text>
          {busy ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} /> : null}
        </View>
      )}

      {/* Bottom action: enter revision picker (regular) OR add guest by phone (revision) */}
      {!feedback && !guestPrompt && !phoneOpen ? (
        <TouchableOpacity
          onPress={() => (revisionMode ? (setGErr(''), setPhoneOpen(true)) : router.push('/(teacher)/revisions' as Href))}
          activeOpacity={0.85}
          style={{ position: 'absolute', bottom: insets.bottom + spacing.xl, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: revisionMode ? colors.accentWarm : 'rgba(255,255,255,0.16)', borderRadius: radius.full }}
        >
          <Icon name={revisionMode ? 'phone' : 'book'} size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>
            {revisionMode ? t('teacher.guest_by_phone') : t('teacher.revision_open')}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Off-roster guest prompt */}
      {guestPrompt ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(76,29,149,0.96)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Icon name="child" size={56} color="#fff" />
          <Text style={{ fontFamily: fonts.regular, fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: spacing.lg }}>{t('teacher.guest_offroster')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: 4 }}>{guestPrompt.name}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: spacing.md, textAlign: 'center' }}>
            {isSpread ? t('teacher.guest_billed') : t('teacher.guest_free')}
          </Text>
          <TouchableOpacity onPress={confirmGuest} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: '#fff', borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#4c1d95' }}>{t('teacher.guest_add')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setGuestPrompt(null); setGErr(''); setPhoneOpen(true); }} activeOpacity={0.85} style={{ marginTop: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('teacher.guest_by_phone')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setGuestPrompt(null); setBusy(false); }} activeOpacity={0.85} style={{ marginTop: spacing.lg }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{t('teacher.guest_ignore')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Add-guest-by-phone form */}
      {phoneOpen ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(23,16,43,0.97)', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff', textAlign: 'center' }}>{t('teacher.guest_phone_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: spacing.sm }}>{t('teacher.guest_phone_hint')}</Text>
          <TextInput
            value={gName}
            onChangeText={setGName}
            placeholder={t('teacher.guest_name')}
            placeholderTextColor="rgba(0,0,0,0.4)"
            style={{ marginTop: spacing.xl, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 54, fontFamily: fonts.medium, fontSize: 18, color: '#111', textAlign: 'center' }}
          />
          <TextInput
            value={gPhone}
            onChangeText={setGPhone}
            placeholder={t('teacher.guest_phone_ph')}
            placeholderTextColor="rgba(0,0,0,0.4)"
            keyboardType="phone-pad"
            style={{ marginTop: spacing.md, backgroundColor: '#fff', borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 54, fontFamily: fonts.medium, fontSize: 18, color: '#111', textAlign: 'center' }}
          />
          {gErr ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.warningLight, textAlign: 'center', marginTop: spacing.md }}>{gErr}</Text> : null}
          <TouchableOpacity onPress={submitPhone} disabled={busy} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.accentWarm, borderRadius: radius.lg, minHeight: 54, justifyContent: 'center', alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.guest_phone_submit')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPhoneOpen(false); setGErr(''); setBusy(false); }} activeOpacity={0.85} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.75)' }}>{t('teacher.guest_cancel')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Full-screen success/failure flash */}
      {feedback ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: feedback.success ? 'rgba(31,147,102,0.96)' : 'rgba(203,58,76,0.96)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }} pointerEvents="none">
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name={feedback.success ? 'success' : 'warning'} size={64} color="#fff" />
          </View>
          {feedback.student_name ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: '#fff', textAlign: 'center', marginTop: spacing.lg }}>{feedback.student_name}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 19, lineHeight: 28, color: '#fff', textAlign: 'center', marginTop: spacing.sm }}>
            {feedback.message || (feedback.success ? t('teacher.checked_in') : t('teacher.scan_failed'))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
