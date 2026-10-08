import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SheetModal } from '@/components/ui/SheetModal';
import { ScrollView } from '@/components/ui/Refreshable';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import type { RoseSheetSession, RoseSheetItem } from '@/api/cash';

/**
 * What stands behind one line of «ورقة النهارده» (founder 2026-10-08: «every element on the
 * sheet, on click, a modal of its details»): a session — its time, class, place, attendance and
 * a button into the session; or a fact — her sentence, then the students behind it (who the
 * door will stop and what they owe, today's collections, the complaints waiting), each opening
 * the student, with the one action the fact calls for.
 */
export type SheetDetailTarget =
  | { type: 'session'; session: RoseSheetSession }
  | { type: 'fact'; kind: string; text: string; items: RoseSheetItem[] | undefined };

const FACT_LOOK = (): Record<string, { icon: IconName; tint: string; title: string; action?: { label: string; href: Href } }> => ({
  dues: { icon: 'warning', tint: colors.danger, title: 'هيقفوا على الباب', action: { label: 'افتح التحصيل', href: '/(teacher)/pending-collections' as Href } },
  dues_clear: { icon: 'success', tint: colors.success, title: 'مفيش متأخرات' },
  collected: { icon: 'money', tint: colors.success, title: 'تحصيل النهارده' },
  complaints: { icon: 'note', tint: colors.accent, title: 'اعتراضات مستنية قرار', action: { label: 'افتح الاعتراضات', href: '/(teacher)/complaints' as Href } },
  review: { icon: 'eye', tint: colors.brand, title: 'قرارات المساعد', action: { label: 'افتح الاعتراضات', href: '/(teacher)/complaints' as Href } },
});

export function SheetDetail({ target, onClose }: { target: SheetDetailTarget | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const go = (href: Href) => { onClose(); setTimeout(() => router.push(href), 60); };

  return (
    <SheetModal visible={!!target} onClose={onClose} style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '85%' }}>
      {target?.type === 'session' ? <SessionBody s={target.session} go={go} /> : null}
      {target?.type === 'fact' ? <FactBody kind={target.kind} text={target.text} items={target.items} go={go} /> : null}
    </SheetModal>
  );
}

function SessionBody({ s, go }: { s: RoseSheetSession; go: (h: Href) => void }) {
  const ended = s.present !== null;
  const total = (s.present ?? 0) + (s.absent ?? 0);
  const row = (icon: IconName, label: string, value: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
      <Icon name={icon} size={16} color={colors.textTertiary} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, textAlign: 'left' }} numberOfLines={2}>{value}</Text>
    </View>
  );
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ minWidth: 64, paddingHorizontal: 10, height: 34, borderRadius: radius.md, backgroundColor: colors.brand + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{s.time}</Text>
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }} numberOfLines={2}>{s.title}</Text>
      </View>
      {row('location', 'المكان', s.venue ?? '—')}
      {row('lesson', 'النوع', s.exam ? 'حصة امتحان' : 'حصة')}
      {row('attendance', 'الحضور', ended ? `${formatNumber(s.present ?? 0)} حضر · ${formatNumber(s.absent ?? 0)} غاب${total ? ` من ${formatNumber(total)}` : ''}` : 'لم تنتهِ بعد')}
      {s.id ? (
        <TouchableOpacity onPress={() => go(`/(teacher)/sessions/${s.id}` as Href)} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Icon name="attendance" size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>افتح الحصة وكشف الحضور</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function FactBody({ kind, text, items, go }: { kind: string; text: string; items: RoseSheetItem[] | undefined; go: (h: Href) => void }) {
  const look = FACT_LOOK()[kind] ?? { icon: 'note' as IconName, tint: colors.textSecondary, title: 'تفاصيل' };
  const list = items ?? [];
  const sum = list.reduce((n, i) => n + (i.amount ?? 0), 0);
  return (
    <View style={{ flexShrink: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: look.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={look.icon} size={18} color={look.tint} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{look.title}</Text>
        {list.length > 0 ? (
          <View style={{ minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: look.tint, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#fff' }}>{formatNumber(list.length)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'right' }}>{text}</Text>

      {list.length > 0 ? (
        <ScrollView style={{ marginTop: spacing.md, maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {list.map((i, n) => (
            <TouchableOpacity key={n} disabled={!i.student_id} onPress={() => i.student_id && go(`/(teacher)/students/${i.student_id}` as Href)} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right' }} numberOfLines={1}>{i.title}</Text>
                {i.sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 1, textAlign: 'right' }} numberOfLines={1}>{i.sub}</Text> : null}
              </View>
              {i.amount != null ? <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: kind === 'dues' ? colors.danger : colors.textPrimary }}>{`${formatNumber(i.amount)} ج.م`}</Text> : null}
              {i.student_id ? <Icon name="back" size={16} color={colors.textTertiary} /> : null}
            </TouchableOpacity>
          ))}
          {sum > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1.5, borderTopColor: colors.border }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, textAlign: 'right' }}>الإجمالي</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.textPrimary }}>{`${formatNumber(sum)} ج.م`}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : items === undefined && kind !== 'dues_clear' ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.md, textAlign: 'right' }}>التفاصيل تظهر بعد تحديث الخادم.</Text>
      ) : null}

      {look.action ? (
        <TouchableOpacity onPress={() => go(look.action!.href)} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: look.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: look.tint }}>{look.action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
