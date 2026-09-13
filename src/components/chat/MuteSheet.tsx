import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/**
 * Stop one student writing, for a stated number of hours (§3).
 *
 * The sheet exists to make the rule visible rather than to enforce it — the server already
 * refuses a mute with no reason, one over the ceiling, or one aimed at staff. What it must
 * do is tell the teacher, before they tap, exactly what will happen: the student is told,
 * **the parent is told**, it expires by itself, and reading is never taken away. A mute that
 * felt like a silent punishment is the thing §3 exists to prevent.
 */
export function MuteSheet({
  target, maxHours, pending, onClose, onSubmit,
}: {
  target: { id: number; name: string } | null;
  maxHours: number;
  pending: boolean;
  onClose: () => void;
  onSubmit: (hours: number, reason: string) => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [hours, setHours] = useState(24);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (target) { setHours(24); setReason(''); }
  }, [target?.id]);

  // Offer the durations a teacher actually reaches for, capped by what the server allows.
  const presets = [1, 3, 12, 24, 48, 72].filter((h) => h <= maxHours);
  const canSubmit = reason.trim().length >= 3 && hours >= 1 && hours <= maxHours && !pending;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'right' }}>
            {t('chat.mute_title', { name: target?.name ?? '' })}
          </Text>

          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right', marginTop: spacing.lg, marginBottom: spacing.sm }}>
            {t('chat.mute_duration')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {presets.map((h) => {
              const on = hours === h;
              return (
                <TouchableOpacity
                  key={h}
                  onPress={() => setHours(h)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}
                >
                  <Text style={{ fontFamily: on ? fonts.bold : fonts.regular, fontSize: 15, color: on ? colors.brand : colors.textSecondary }}>
                    {t('chat.mute_hours', { count: h })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right', marginTop: spacing.lg, marginBottom: spacing.sm }}>
            {t('chat.mute_reason')} <Text style={{ color: colors.danger }}>*</Text>
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t('chat.mute_reason_placeholder')}
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
            style={{ fontFamily: fonts.regular, fontSize: 15, minHeight: 48, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 12, color: colors.textPrimary, textAlign: 'right' }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
            <Icon name="info" size={16} color={colors.warningText} outline style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.warningText, textAlign: 'right' }}>
              {t('chat.mute_consequences', { max: maxHours })}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSubmit(hours, reason.trim())}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{ flex: 1.4, minHeight: 50, borderRadius: radius.lg, backgroundColor: canSubmit ? colors.warning : colors.border, justifyContent: 'center', alignItems: 'center' }}
            >
              {pending ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('chat.mute_confirm')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
