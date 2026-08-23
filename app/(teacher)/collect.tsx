import { View, Text, TouchableOpacity } from 'react-native';
import { router, Redirect, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { TeacherTip } from '@/components/TeacherTip';

export default function TeacherCollect() {
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.role);

  // Financial collection is never available to an assistant on mobile — hard block
  // even if this route is reached directly (deep link / back-stack), regardless of
  // any ability config.
  if (role === 'assistant') {
    return <Redirect href={'/(teacher)' as Href} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>تحصيل الدفعات</Text>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {/* Roster (no scan) — the whole collection list with remaining + paid per student. */}
        <TouchableOpacity
          onPress={() => router.push('/(teacher)/pending-collections' as Href)}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brand + '12', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.brand + '33', padding: spacing.lg }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brand + '22', justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="reports" size={24} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>قائمة التحصيلات</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>كل الطلاب ومستحقاتهم — المتبقّي والمدفوع — والتحصيل بلمسة دون مسح</Text>
          </View>
          <Icon name="back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* One scan → every due (فاتورة + ملزمة + دفعة حجز) in a single popup, each
            collectable fully or partially. Replaces the old per-type cards. */}
        <TouchableOpacity
          onPress={() => router.push('/(teacher)/scan?payKind=all' as Href)}
          activeOpacity={0.85}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
            <Icon name="scan" size={24} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>امسح لتحصيل المستحقات</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>امسح البطاقة لعرض كل المستحقات — الفواتير والملازم ودفعة الحجز — والتحصيل كليًا أو جزئيًا</Text>
          </View>
          <Icon name="back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TeacherTip
        tip="billing"
        icon="money"
        titleKey="onboarding.tip_billing_title"
        bodyKey="onboarding.tip_billing_body"
        bulletKeys={['onboarding.tip_billing_b1', 'onboarding.tip_billing_b2']}
      />
    </View>
  );
}
