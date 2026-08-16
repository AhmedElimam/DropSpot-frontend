import { View, Text, TouchableOpacity } from 'react-native';
import { router, Redirect, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { TeacherTip } from '@/components/TeacherTip';

function Option({ kind, title, subtitle, icon }: { kind: 'bill' | 'booklet' | 'booking'; title: string; subtitle: string; icon: IconName }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(`/(teacher)/scan?payKind=${kind}` as Href)}
      activeOpacity={0.85}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
        <Icon name={icon} size={24} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{subtitle}</Text>
      </View>
      <Icon name="back" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

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
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>تحصيل الدفعات</Text>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Option kind="bill" title="دفع الفواتير" subtitle="امسح البطاقة لتحصيل الفاتورة المستحقة" icon="money" />
        <Option kind="booklet" title="دفع الملازم" subtitle="امسح البطاقة لتحصيل رسم الملزمة" icon="book" />
        <Option kind="booking" title="دفع دفعة الحجز" subtitle="امسح البطاقة لتحصيل دفعة الحجز — كليًا أو جزئيًا" icon="money" />
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
