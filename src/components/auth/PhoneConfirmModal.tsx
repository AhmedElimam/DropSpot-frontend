import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/**
 * A pause-and-reconsider gate in front of registration's phone step: it restates
 * why the parent number matters and forces a short delay before "confirm" enables,
 * so the family actually re-reads the number they typed. This is NOT a security
 * gate — the underlying OTP verification is unchanged; this only slows an impulsive
 * wrong-number submit.
 */
export function PhoneConfirmModal({
  visible,
  phone,
  delaySeconds = 7,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  phone: string;
  delaySeconds?: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [remaining, setRemaining] = useState(delaySeconds);

  useEffect(() => {
    if (!visible) return;
    setRemaining(delaySeconds);
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1000);
    return () => clearInterval(id);
  }, [visible, delaySeconds]);

  const ready = remaining <= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.lg }}>
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.warningLight ?? colors.brandTint, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
              <Icon name="warning" size={28} color={colors.warning} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 21, color: colors.textPrimary, textAlign: 'right' }}>
              {t('auth.confirm_phone_title')}
            </Text>

            {/* The number under review — shown LTR so digits read correctly. */}
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingVertical: spacing.md, marginTop: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, writingDirection: 'ltr' }} selectable>
                {phone || '—'}
              </Text>
            </View>

            <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.md }}>
              {t('auth.parent_phone_warning')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }}>
            <TouchableOpacity onPress={onCancel} style={{ flex: 1, minHeight: 52, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.textSecondary }}>{t('auth.confirm_phone_edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => ready && onConfirm()}
              disabled={!ready}
              activeOpacity={0.85}
              style={{ flex: 2, minHeight: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: ready ? 1 : 0.55 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>
                {ready ? t('auth.confirm_phone_confirm') : t('auth.confirm_phone_wait', { n: remaining })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
