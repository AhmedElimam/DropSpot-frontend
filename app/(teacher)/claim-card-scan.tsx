import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Alert } from '@/ui/dialog';
import { Surface } from '@/ui/surfaces';
import { claimTeacherCard, lookupTeacherCard } from '@/api/teacherCards';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { ScanFrame, outsideFrame, type Pt } from '@/components/teacher/ScanFrame';

/** The camera stops after this long without a card — a sensor left running on a desk heats a cheap phone. */
const IDLE_MS = 60_000;

function serverMessage(e: unknown): string {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof m === 'string' && m.trim() ? m : getFriendlyErrorMessage(e);
}

function serverCode(e: unknown): string | null {
  const c = (e as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof c === 'string' ? c : null;
}

/**
 * «ربط كارت المدرّس» from the student's profile (founder 2026-11-05): the student is already
 * chosen; the camera reads the blank's QR or barcode, and the teacher confirms «الكارت ده هيبقى
 * بتاع …؟». Claiming records no attendance. The camera runs only while this screen is focused,
 * no question is open, and a card was seen in the last minute.
 */
export default function ClaimCardScanScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { student, name } = useLocalSearchParams<{ student?: string; name?: string }>();
  const studentId = Number(student);
  const studentName = typeof name === 'string' ? name : '';

  const [scanning, setScanning] = useState(true);
  const lock = useRef(false);

  // Idle: no card for a minute → the camera stops; one tap starts it again.
  useEffect(() => {
    if (!scanning) return undefined;
    const timer = setTimeout(() => setScanning(false), IDLE_MS);
    return () => clearTimeout(timer);
  }, [scanning]);

  const resume = useCallback(() => { lock.current = false; setScanning(true); }, []);

  const claim = useCallback(async (code: string, replace: boolean) => {
    try {
      const message = await claimTeacherCard(code, studentId, replace);
      qc.invalidateQueries({ queryKey: ['teacher-cards'] });
      Alert.alert(message || t('teacher_cards.claimed'));
      router.back();
    } catch (e) {
      if (serverCode(e) === 'TEACHER_CARD_STUDENT_HAS_ONE') {
        Alert.alert(t('teacher_cards.has_one_title'), serverMessage(e), [
          { text: t('common.cancel'), style: 'cancel', onPress: resume },
          { text: t('teacher_cards.replace_lost'), style: 'destructive', onPress: () => { void claim(code, true); } },
        ]);
        return;
      }
      Alert.alert(t('teacher_cards.refused_title'), serverMessage(e), [{ text: t('common.ok'), onPress: resume }]);
    }
  }, [studentId, qc, t, resume]);

  const onScan = useCallback(async ({ data, bounds, cornerPoints }: { data: string; bounds?: { origin?: Pt; size?: { width: number; height: number } }; cornerPoints?: Pt[] }) => {
    // Same focus gate as the door: only a card lined up inside the frame counts.
    if (lock.current || !data || outsideFrame(bounds, cornerPoints)) return;
    lock.current = true;
    setScanning(false);
    Vibration.vibrate(40);
    try {
      const card = await lookupTeacherCard(data);
      if (card.status !== 'unclaimed') {
        Alert.alert(t('teacher_cards.card_no', { seq: card.seq }), card.status_label, [{ text: t('common.ok'), onPress: resume }]);
        return;
      }
      Alert.alert(t('teacher_cards.confirm_title'), t('teacher_cards.confirm_body_scan', { seq: card.seq, name: studentName }), [
        { text: t('common.cancel'), style: 'cancel', onPress: resume },
        { text: t('teacher_cards.claim'), onPress: () => { void claim(data, false); } },
      ]);
    } catch (e) {
      Alert.alert(t('teacher_cards.refused_title'), serverMessage(e), [{ text: t('common.ok'), onPress: resume }]);
    }
  }, [t, studentName, claim, resume]);

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  if (!permission.granted) {
    return (
      <Surface id="screen.teacher.claim-card-scan" screen>
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <Icon name="scan" size={56} color={colors.brand} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.lg }}>{t('teacher.camera_permission_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>{t('teacher.camera_permission_body')}</Text>
        <TouchableOpacity onPress={requestPermission} activeOpacity={0.85} style={{ marginTop: spacing.xl, backgroundColor: colors.brand, borderRadius: radius.lg, minHeight: 52, justifyContent: 'center', paddingHorizontal: spacing.xxl }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('teacher.grant_camera')}</Text>
        </TouchableOpacity>
      </View>
      </Surface>
    );
  }

  const live = isFocused && scanning;

  return (
    <Surface id="screen.teacher.claim-card-scan" screen>
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Android: `active` is iOS-only in expo-camera, so the view is unmounted when not scanning. */}
      {isFocused && (Platform.OS === 'ios' || live) ? (
        <CameraView
          style={{ flex: 1 }}
          active={live}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
          onBarcodeScanned={live ? onScan : undefined}
        />
      ) : (
        <View style={{ flex: 1, backgroundColor: '#000' }} />
      )}

      {scanning ? <ScanFrame label={t('teacher_cards.scan_hint')} /> : null}

      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}
          style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>{t('teacher_cards.claim_for', { name: studentName })}</Text>
        </View>
      </View>

      {!scanning ? (
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + spacing.xl }}>
          <TouchableOpacity onPress={resume} activeOpacity={0.85} accessibilityRole="button"
            style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}>
            <Icon name="scan" size={20} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher_cards.scan_again')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
    </Surface>
  );
}
