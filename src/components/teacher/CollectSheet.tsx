import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { formatEGP } from '@/utils/currency';

/**
 * The one collect sheet — the collections list and the student's page open the same thing
 * (founder 2026-10-10: «make the payment modal on student details like the pending
 * collection modal»): what and whose on top with what is still owed, anything extra (the
 * collections list puts its bill corrections here), the amount with «الكل» / «النصف»,
 * and the green confirm.
 *
 * `amount` null means «follow the full remainder» — it tracks `owed` until the person types.
 * `locked` (collecting everything at once) shows the total but takes no partial amount.
 */
export function CollectSheet({
  visible, onClose, title, name, owed, amount, onAmount, locked, busy, onSubmit, hint, children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  name?: string;
  owed: number;
  amount: string | null;
  onAmount: (v: string | null) => void;
  locked?: boolean;
  busy: boolean;
  onSubmit: () => void;
  hint?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shown = amount ?? String(owed);
  const ok = Number(shown) > 0;
  const quick = locked ? [] : [{ label: t('collections.full'), v: owed, follow: true }, { label: t('collections.half'), v: Math.round(owed / 2), follow: false }];
  const close = () => { if (!busy) onClose(); };

  return (
    <SheetModal visible={visible} onClose={close} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="money" size={24} color={colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }} numberOfLines={2}>{title}</Text>
          {name ? <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>{name}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{formatEGP(owed)}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary }}>{t('collections.remaining')}</Text>
        </View>
      </View>

      {children}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          value={shown}
          onChangeText={(v) => onAmount(v.replace(/[^0-9.]/g, ''))}
          editable={!locked}
          keyboardType="numeric"
          selectTextOnFocus
          accessibilityLabel={t('collections.bill_amount')}
          style={{ flex: 1, height: 52, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: spacing.md, fontFamily: fonts.bold, fontSize: 20, color: locked ? colors.textSecondary : colors.textPrimary, textAlign: 'center' }}
        />
        {quick.map((q) => {
          const on = Number(shown) === q.v;
          return (
            <TouchableOpacity key={q.label} onPress={() => onAmount(q.follow ? null : String(q.v))} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: spacing.md, height: 52, justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: on ? colors.brand : 'transparent' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? '#fff' : colors.brand }}>{q.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary, marginTop: spacing.sm }}>{hint ?? t('collections.partial_hint')}</Text>

      <TouchableOpacity
        onPress={onSubmit}
        disabled={busy || !ok}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.md, backgroundColor: ok ? colors.success : colors.border, justifyContent: 'center', alignItems: 'center' }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('collections.confirm')}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={close} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.close')}</Text>
      </TouchableOpacity>
    </SheetModal>
  );
}
