import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';

/** 0 = nothing typed, 1 weak, 2 fair, 3 strong. The server requires only 6+ chars. */
export function passwordScore(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[0-9]/.test(pw) && /[^0-9]/.test(pw)) s++;
  return Math.min(3, Math.max(1, s)) as 1 | 2 | 3;
}

/**
 * Three small bars + one word under a password field. Gentle on purpose: anything
 * from 6 characters is accepted (that is the server's rule), the meter only nudges.
 */
export function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();
  const score = passwordScore(password);
  if (score === 0) return null;
  const tone = score === 1 ? colors.danger : score === 2 ? colors.warning : colors.success;
  const word = score === 1 ? t('auth.password_weak') : score === 2 ? t('auth.password_fair') : t('auth.password_strong');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: 4, flex: 1 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= score ? tone : colors.borderLight }} />
        ))}
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: tone }}>
        {password.length < 6 ? t('auth.password_too_short') : word}
      </Text>
    </View>
  );
}
