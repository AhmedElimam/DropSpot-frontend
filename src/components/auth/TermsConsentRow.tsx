import { View, Text, TouchableOpacity } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { termsUrl, type TermsRole } from '@/api/terms';
import { useTermsContent } from '@/hooks/useTermsContent';

/**
 * An UNCHECKED-by-default consent row: a checkbox the user must tap plus a link to
 * the binding full-text Terms (opened in the browser). Used at registration
 * (student) and parent setup, and inside the blocking accept screen. Never
 * pre-ticked — the tap is the consent.
 */
export function TermsConsentRow({
  role,
  checked,
  onToggle,
}: {
  role: TermsRole;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { t } = useTranslation();
  const { contentFor } = useTermsContent();
  const checkboxLabel = contentFor(role)?.checkbox ?? t(`terms.checkbox_${role}`);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <TouchableOpacity
        onPress={() => onToggle(!checked)}
        activeOpacity={0.75}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.sm,
            borderWidth: 2,
            borderColor: checked ? colors.brand : colors.borderStrong,
            backgroundColor: checked ? colors.brand : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 2,
          }}
        >
          {checked ? <Icon name="success" size={16} color={colors.textInverse} /> : null}
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'right' }}>
          {checkboxLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => WebBrowser.openBrowserAsync(termsUrl(role))}
        style={{ marginTop: spacing.sm, minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>
          {t('terms.read_full')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
