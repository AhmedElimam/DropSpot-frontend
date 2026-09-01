import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getNotificationPrefs, updateNotificationPrefs, type NotificationPrefs } from '@/api/notifications';

/**
 * Self-service notification preferences (Tier A) — any user (student/parent/teacher) can
 * silence pushes they don't want, most importantly the periodic digest, without muting the
 * whole app. Auto-saves on each toggle. In-app feed is unaffected; only pushes are gated.
 */
export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPrefs>({ push: true, digest: true });

  const { data, isLoading } = useQuery({ queryKey: ['notification-prefs'], queryFn: getNotificationPrefs });
  useEffect(() => { if (data) setPrefs(data); }, [data]);

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) => updateNotificationPrefs(next),
    onError: () => { if (data) setPrefs(data); }, // revert to server truth on failure
  });

  const set = (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    save.mutate(next);
  };

  const Row = ({ title, subtitle, value, onValueChange, disabled }: {
    title: string; subtitle: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean;
  }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} trackColor={{ true: colors.brand }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>تفضيلات الإشعارات</Text>
        {save.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : null}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.brand} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg }}>
            <Row
              title="الإشعارات الفورية"
              subtitle="استقبال إشعارات التطبيق على هذا الجهاز (تبقى الإشعارات داخل التطبيق متاحة دائمًا)."
              value={prefs.push}
              onValueChange={(v) => set({ push: v })}
            />
            <View style={{ height: 1, backgroundColor: colors.borderLight }} />
            <Row
              title="الملخّص الدوري"
              subtitle="الملخّص اليومي/الدوري عن الحضور والرسوم. أوقفه لإسكات إشعار الملخّص فقط."
              value={prefs.digest}
              onValueChange={(v) => set({ digest: v })}
              disabled={!prefs.push}
            />
          </View>

          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.md, textAlign: 'center' }}>
            لا تتأثر رسائل التحقق والأمان (OTP) بهذه الإعدادات.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
