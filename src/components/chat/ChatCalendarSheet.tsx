import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { SheetModal } from '@/components/ui/SheetModal';
import { Icon } from '@/components/ui/Icon';
import { useChatCalendar } from '@/hooks/useChat';
import { formatDateOnly, formatNumber } from '@/utils/format';
import { fromYmd, heat, monthBounds, monthGrid, ymd } from '@/chat/roomView';

// Saturday first — the Egyptian week.
const WEEKDAYS = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];

/**
 * «Go to a day» (founder 2026-10-12: «see the conversation by dates, like Telegram»).
 *
 * A month at a time, Saturday first. A day the room spoke on is a filled circle whose shade
 * says how busy it was; a silent day is greyed and cannot be picked. Months outside the
 * room's life are not offered. Two shortcuts: the room's very first message, and today.
 */
export function ChatCalendarSheet({ visible, courseId, onClose, onPick, onLatest }: {
  visible: boolean;
  courseId: number;
  onClose: () => void;
  /** YYYY-MM-DD */
  onPick: (date: string) => void;
  onLatest: () => void;
}) {
  const { t } = useTranslation();
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  useEffect(() => { if (visible) setCursor({ y: today.getFullYear(), m: today.getMonth() }); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const { from, to } = monthBounds(cursor.y, cursor.m);
  const cal = useChatCalendar(courseId, from, to, visible);
  const days = cal.data?.days ?? {};
  const max = useMemo(() => Math.max(0, ...Object.values(days)), [days]);
  const weeks = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const first = cal.data?.first ?? null;
  const todayKey = ymd(today);

  const monthKey = (y: number, m: number) => y * 12 + m;
  const firstMonth = first ? monthKey(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1) : monthKey(cursor.y, cursor.m);
  const canPrev = monthKey(cursor.y, cursor.m) > firstMonth;
  const canNext = monthKey(cursor.y, cursor.m) < monthKey(today.getFullYear(), today.getMonth());
  const step = (d: number) => setCursor((c) => { const n = new Date(c.y, c.m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const total = Object.values(days).reduce((a, b) => a + b, 0);

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'right' }}>{t('chat.calendar_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'right', marginTop: 2 }}>{t('chat.calendar_hint')}</Text>

        {/* Month header. RTL: the "previous" chevron sits on the right. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={() => step(-1)} disabled={!canPrev} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('chat.calendar_prev')}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken, opacity: canPrev ? 1 : 0.35 }}>
            <Icon name="forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{formatDateOnly(new Date(cursor.y, cursor.m, 1), { month: 'long', year: 'numeric' })}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>
              {cal.isLoading ? ' ' : total > 0 ? t('chat.calendar_month_total', { n: formatNumber(total) }) : t('chat.calendar_month_empty')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => step(1)} disabled={!canNext} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('chat.calendar_next')}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken, opacity: canNext ? 1 : 0.35 }}>
            <Icon name="back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 4 }}>
          {WEEKDAYS.map((d) => (
            <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{d}</Text>
          ))}
        </View>

        <View style={{ minHeight: 6 * 46 }}>
          {cal.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : weeks.map((w, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {w.map((d, di) => {
                if (!d) return <View key={di} style={{ flex: 1, height: 46 }} />;
                const n = days[d] ?? 0;
                const level = heat(n, max);
                const isToday = d === todayKey;
                const bg = level === 0 ? 'transparent' : [colors.brandTint, colors.brandTint, colors.brand + 'AA', colors.brand + 'DD', colors.brand][level];
                const ink = level >= 3 ? '#FFFFFF' : level > 0 ? colors.brand : colors.textTertiary;
                return (
                  <TouchableOpacity
                    key={di}
                    disabled={n === 0}
                    onPress={() => onPick(d)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: n === 0 }}
                    accessibilityLabel={`${formatDateOnly(fromYmd(d), { day: 'numeric', month: 'long' })} — ${n > 0 ? t('chat.calendar_day_count', { n: formatNumber(n) }) : t('chat.calendar_day_empty')}`}
                    style={{ flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{
                      width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: bg, borderWidth: isToday ? 1.5 : 0, borderColor: colors.accent,
                    }}>
                      <Text style={{ fontFamily: level > 0 ? fonts.bold : fonts.regular, fontSize: 14, color: ink, opacity: n === 0 ? 0.55 : 1 }}>
                        {formatDateOnly(fromYmd(d), { day: 'numeric' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity onPress={() => first && onPick(first)} disabled={!first} accessibilityRole="button"
            style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: first ? 1 : 0.5 }}>
            <Icon name="up" size={16} color={colors.textSecondary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('chat.calendar_first')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLatest} accessibilityRole="button"
            style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="down" size={16} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('chat.calendar_latest')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SheetModal>
  );
}
