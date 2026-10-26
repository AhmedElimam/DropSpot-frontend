import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { updateMyGender, type TeacherGender } from '@/api/profile';

const OPTIONS: { key: TeacherGender; label: string }[] = [
  { key: 'male', label: 'teacher.gender_male' },
  { key: 'female', label: 'teacher.gender_female' },
];

/**
 * «صيغة المخاطبة» — a teacher says whether she is «أستاذة» or he is «أستاذ» (founder
 * 2026-10-26: female teachers were addressed as men everywhere). One value on the server;
 * every SMS, page, PDF and this app's own greeting, role chip and badge read it. Applies at
 * once here (the cached user is patched) and on the server for everything it sends.
 */
export function GenderRow() {
  const { t } = useTranslation();
  const gender = useAuthStore((s) => s.user?.gender ?? 'male');
  const patchUser = useAuthStore((s) => s.patchUser);
  const [saving, setSaving] = useState<TeacherGender | null>(null);

  const choose = async (next: TeacherGender) => {
    if (next === gender || saving) return;
    setSaving(next);
    try {
      const r = await updateMyGender(next);
      await patchUser({ gender: r.gender });
    } catch {
      Alert.alert(t('common.error'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
        padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
          <Icon name="teacher" size={22} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{t('teacher.gender_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{t('teacher.gender_sub')}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        {OPTIONS.map((o) => {
          const on = gender === o.key;
          return (
            <TouchableOpacity
              key={o.key}
              onPress={() => { void choose(o.key); }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, busy: saving === o.key }}
              activeOpacity={0.8}
              style={{
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
                minHeight: 44, borderRadius: radius.lg, borderWidth: on ? 1.5 : 1,
                borderColor: on ? colors.neon : colors.border,
                backgroundColor: on ? colors.neonTint : colors.surfaceSunken,
              }}
            >
              {saving === o.key ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: on ? colors.textPrimary : colors.textSecondary }}>{t(o.label)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
