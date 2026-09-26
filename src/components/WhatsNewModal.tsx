import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useWhatsNew } from '@/hooks/useReleaseNotes';
import { usePendingSurvey } from '@/hooks/useSurvey';
import { useTeacherOnboarding } from '@/hooks/useTeacherOnboarding';
import { useAuthStore } from '@/stores/authStore';

/**
 * «ما الجديد» as a popup, once per installed version, right after the update. Written at
 * /admin/release-notes. It yields to the survey and the teacher's first-run walkthrough —
 * two popups at once is worse than one late — and the home card still carries the notes
 * when it yields.
 */
const BLOCKING_PREFIXES = [
  '/accept-terms', '/change-password', '/verify-own-number', '/parent-setup', '/needs-teacher',
  '/request-name-correction', '/impersonate', '/invite', '/login', '/register', '/verify-otp', '/forgot-password',
  '/reset-password', '/welcome',
  '/scan', '/enroll', '/check-in', '/whats-new',
];

export function WhatsNewModal() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);
  const { note, showPopup, dismissPopup, popupDone } = useWhatsNew();
  const { data: survey } = usePendingSurvey();
  const { data: onboarding } = useTeacherOnboarding();
  const onboardingDue = role === 'teacher' && !!onboarding && onboarding.active && !onboarding.steps.intro && !onboarding.has_courses;

  // Never over a screen that must be finished first (terms, password, login, set-up), and
  // never at the door: a popup mid-scan costs a student their check-in.
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  const visible = showPopup && !!note && !survey && !onboardingDue && !blocked;
  if (!note) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismissPopup}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.55)', justifyContent: 'center', padding: spacing.xl, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, maxHeight: '85%' }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="star" size={28} color={colors.brand} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>{note.title || t('whats_new.title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('whats_new.version', { version: note.version })}</Text>
          </View>
          <ScrollView style={{ marginTop: spacing.lg }} contentContainerStyle={{ gap: spacing.sm }}>
            {note.lines.map((line, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Icon name="success" size={16} color={colors.brand} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary }}>{line}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={dismissPopup} activeOpacity={0.85} accessibilityRole="button"
            style={{ marginTop: spacing.xl, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('whats_new.ok')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { popupDone(); router.push('/whats-new' as never); }} style={{ marginTop: spacing.md, alignSelf: 'center', paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('whats_new.all')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
