import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator, Alert, AppState, type AppStateStatus } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { checkRelocation, dismissRelocation, relocateAll } from '@/api/location';

// Match the course-location capture: >20m is "low confidence".
const PREFERRED_ACCURACY = 20;

/**
 * "You seem to have moved — relocate your sessions?" Checks on mount + foreground; if the
 * teacher is on a new IP with geofenced courses, a modal captures fresh GPS (expo-location,
 * same pattern as course-location capture) and updates ALL their course anchors at once.
 * Dismiss remembers the IP so it won't nag. Mounted once in the teacher layout.
 */
export function RelocationPrompt({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = () => {
      checkRelocation().then((needs) => { if (alive && needs) setVisible(true); }).catch(() => {});
    };
    run();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => { if (s === 'active') run(); });
    return () => { alive = false; sub.remove(); };
  }, [enabled]);

  const dismiss = () => {
    setVisible(false);
    dismissRelocation().catch(() => {});
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const enabledSvc = await Location.hasServicesEnabledAsync();
      if (!enabledSvc) { Alert.alert(t('teacher.location_services_off_title'), t('teacher.location_services_off_hint')); return; }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { Alert.alert(t('teacher.location_denied_title'), t('teacher.location_denied_hint')); return; }

      let pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
      if (!pos) pos = await Location.getLastKnownPositionAsync();
      if (!pos) { Alert.alert(t('teacher.location_no_fix_title'), t('teacher.location_no_fix_hint')); return; }

      const acc = pos.coords.accuracy ?? undefined;
      const count = await relocateAll({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        location_accuracy_meters: acc,
        location_source: acc != null && acc > PREFERRED_ACCURACY ? 'gps_low' : 'gps',
      });
      setVisible(false);
      Alert.alert('', t('teacher.relocate_done'));
      void count;
    } catch {
      Alert.alert(t('common.error'), t('teacher.relocate_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom / 2 }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.brand + '18', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.md }}>
            <Icon name="location" size={30} color={colors.brand} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'center' }}>{t('teacher.relocate_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
            {t('teacher.relocate_body')}
          </Text>

          <TouchableOpacity onPress={confirm} disabled={busy} activeOpacity={0.85}
            style={{ marginTop: spacing.xl, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('teacher.relocate_confirm')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={dismiss} disabled={busy} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('teacher.relocate_dismiss')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
