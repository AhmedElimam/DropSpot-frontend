import { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Vibration, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { scanCard, type ScanResult } from '@/api/teacher';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import { Icon } from '@/components/ui/Icon';

const COOLDOWN_MS = 2500; // ignore repeat reads of the same card
const FEEDBACK_MS = 1600; // how long the green/red result stays before resuming

export default function TeacherScan() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { name } = useLocalSearchParams<{ name: string; id: string }>();
  const { data: sessions } = useTeacherTodaySessions();
  // Session label: an explicit tap from Home wins; otherwise auto-derive from the
  // single live session (fallback for a teacher who opens the Camera tab directly,
  // spec §3). Scanning itself is per-card and works regardless of this label.
  const currentSessions = (sessions ?? []).filter((s) => s.is_current);
  const sessionName = name || (currentSessions.length === 1 ? currentSessions[0].course_name ?? '' : '');
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [feedback, setFeedback] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      const now = Date.now();
      if (busy || feedback) return;
      if (data === lastRef.current.code && now - lastRef.current.at < COOLDOWN_MS) return;
      lastRef.current = { code: data, at: now };
      setBusy(true);
      try {
        const res = await scanCard(data);
        // Tactile feedback (no audio lib installed — sound would need a native
        // module + dev build). Short buzz for success, double for failure.
        Vibration.vibrate(res.success ? 60 : [0, 120, 90, 120]);
        setFeedback(res);
        setTimeout(() => {
          setFeedback(null);
          setBusy(false);
        }, FEEDBACK_MS);
      } catch {
        setBusy(false);
      }
    },
    [busy, feedback],
  );

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
        <TouchableOpacity
          onPress={requestPermission}
          activeOpacity={0.85}
          style={{ marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}
        >
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
        barcodeScannerSettings={{
          barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr', 'codabar', 'itf14'],
        }}
        onBarcodeScanned={feedback || busy ? undefined : handleScan}
      />

      {/* Header: session context + switch */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: 'rgba(23,28,59,0.72)', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity onPress={() => router.replace('/(teacher)')} accessibilityRole="button" accessibilityLabel={t('teacher.switch_session')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{t('teacher.scanning_for')}</Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }} numberOfLines={1}>{sessionName || t('teacher.scan_mode')}</Text>
        </View>
        <TouchableOpacity onPress={() => setTorch((v) => !v)} accessibilityRole="button" accessibilityLabel={t('teacher.torch')} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: torch ? colors.accentWarm : 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="eye" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Scan frame + hint */}
      {!feedback && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }} pointerEvents="none">
          <View style={{ width: 260, height: 170, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: 20 }} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: '#fff', marginTop: spacing.lg, textAlign: 'center', paddingHorizontal: spacing.xl }}>
            {busy ? t('teacher.checking') : t('teacher.point_camera')}
          </Text>
          {busy ? <ActivityIndicator color="#fff" style={{ marginTop: spacing.md }} /> : null}
        </View>
      )}

      {/* Full-screen success/failure flash */}
      {feedback ? (
        <View
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: feedback.success ? 'rgba(31,147,102,0.96)' : 'rgba(203,58,76,0.96)',
            justifyContent: 'center', alignItems: 'center', padding: spacing.xl,
          }}
          pointerEvents="none"
        >
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name={feedback.success ? 'success' : 'warning'} size={64} color="#fff" />
          </View>
          {feedback.student_name ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: '#fff', textAlign: 'center', marginTop: spacing.lg }}>
              {feedback.student_name}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: 19, lineHeight: 28, color: '#fff', textAlign: 'center', marginTop: spacing.sm }}>
            {feedback.message || (feedback.success ? t('teacher.checked_in') : t('teacher.scan_failed'))}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
