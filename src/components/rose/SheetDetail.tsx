import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { SheetModal } from '@/components/ui/SheetModal';
import { ScrollView } from '@/components/ui/Refreshable';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { cancelSession } from '@/api/teacherSessions';
import type { RoseSheetSession, RoseSheetItem } from '@/api/cash';
import { useRoseDialog } from './RoseDialog';

/**
 * What stands behind one line of «ورقة النهارده» (founder 2026-10-08: «every element … a modal
 * of its details», then «who will be stopped at the door and for what, and their session; who
 * made the complaint; a fast way to cancel a session, with confirmation, and a button to the
 * whole session; these modals need love»).
 *
 *   a session  a hero card (time, class, place), where it stands (not yet / on now / ended,
 *              who is in), «كل تفاصيل الحصة», and — when the server's rule allows it (nobody
 *              in yet, or not ended) and this person may cancel — «إلغاء الحصة», asked by her.
 *   a fact     her sentence, then one card per student: who, what for (each bill, how long
 *              overdue; the complaint, who filed it, what it says), where they come today —
 *              each card opening the student; a total; the one action the fact calls for.
 *
 * Text alignment is left NATURAL on purpose: under the app's forced RTL, React Native on iOS
 * swaps an explicit 'right' to the LEFT (RCTAttributedTextUtils), which is what put these
 * sheets' text on the wrong side (founder 2026-10-08).
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
  const { ask, tell, dialog } = useRoseDialog();
  const go = (href: Href) => { onClose(); setTimeout(() => router.push(href), 60); };

  return (
    <SheetModal visible={!!target} onClose={onClose} style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
      {target?.type === 'session' ? <SessionBody s={target.session} go={go} ask={ask} tell={tell} onDone={onClose} /> : null}
      {target?.type === 'fact' ? <FactBody kind={target.kind} text={target.text} items={target.items} go={go} /> : null}
      {dialog}
    </SheetModal>
  );
}

// ───────────── a session ─────────────

function SessionBody({ s, go, ask, tell, onDone }: {
  s: RoseSheetSession; go: (h: Href) => void;
  ask: ReturnType<typeof useRoseDialog>['ask']; tell: ReturnType<typeof useRoseDialog>['tell']; onDone: () => void;
}) {
  const qc = useQueryClient();
  const { can } = useActiveAbilities();
  const [busy, setBusy] = useState(false);
  const ended = !!s.ended || s.present !== null;
  const inNow = s.checked_in ?? s.present ?? 0;
  const cancelled = s.status === 'cancelled';
  // The server's rule: a session anyone was checked into happened and stays.
  const canCancel = !!s.id && can(ABILITY.CANCEL_SESSIONS) && !cancelled && (!ended || inNow === 0);
  const phase = cancelled ? { label: 'ملغاة', tint: colors.danger } : ended ? { label: 'انتهت', tint: colors.textSecondary } : { label: 'لم تبدأ بعد', tint: colors.brand };

  const cancel = async () => {
    const ok = await ask({
      title: `أُلغي حصة ${s.time}؟`,
      message: `${s.title}${s.venue ? ` · ${s.venue}` : ''}\n${ended ? 'الحصة انتهت ومحدش اتسجّل فيها — هتخرج من دورة الحساب.' : 'الطلاب وأولياء الأمور هيوصلهم إن الحصة اتلغت.'}`,
      confirm: 'إلغاء الحصة',
      cancel: 'رجوع',
      danger: true,
    });
    if (!ok || !s.id) return;
    setBusy(true);
    try {
      const d = await cancelSession(s.id);
      qc.invalidateQueries({ queryKey: ['rose-sheet'] });
      qc.invalidateQueries({ queryKey: ['teacher-sessions-today'] });
      qc.invalidateQueries({ queryKey: ['teacher-session-detail', String(s.id)] });
      qc.invalidateQueries({ queryKey: ['teacher-session-history'] });
      await tell('اتلغت الحصة', d?.notice ?? `${s.title} · ${s.time}`);
      onDone();
    } catch (e) {
      await tell('ماقدرتش ألغي الحصة', getFriendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const stat = (value: string, label: string, tint: string) => (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: tint }}>{value}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );

  return (
    <View>
      {/* Hero */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ paddingHorizontal: 12, height: 34, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{s.time}</Text>
          </View>
          <View style={{ paddingHorizontal: 10, height: 26, borderRadius: radius.full, backgroundColor: phase.tint + '1A', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: phase.tint }}>{phase.label}</Text>
          </View>
          {s.exam ? (
            <View style={{ paddingHorizontal: 10, height: 26, borderRadius: radius.full, backgroundColor: colors.info + '1A', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.info }}>امتحان</Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.textPrimary, marginTop: spacing.md }}>{s.title}</Text>
        {s.venue ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <Icon name="location" size={14} color={colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{s.venue}</Text>
          </View>
        ) : null}
      </View>

      {/* Where it stands */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        {ended ? (
          <>
            {stat(formatNumber(s.present ?? inNow), 'حضر', colors.success)}
            {stat(formatNumber(s.absent ?? 0), 'غاب', (s.absent ?? 0) > 0 ? colors.danger : colors.textSecondary)}
          </>
        ) : stat(formatNumber(inNow), 'اتسجّل لحد دلوقتي', colors.brand)}
      </View>

      {/* Actions */}
      {s.id ? (
        <TouchableOpacity onPress={() => go(`/(teacher)/sessions/${s.id}` as Href)} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}>
          <Icon name="attendance" size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>كل تفاصيل الحصة وكشف الحضور</Text>
        </TouchableOpacity>
      ) : null}
      {canCancel ? (
        <TouchableOpacity onPress={cancel} disabled={busy} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.sm, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, opacity: busy ? 0.6 : 1 }}>
          {busy ? <ActivityIndicator color={colors.danger} /> : <Icon name="close" size={17} color={colors.danger} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>إلغاء الحصة</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ───────────── a fact ─────────────

function FactBody({ kind, text, items, go }: { kind: string; text: string; items: RoseSheetItem[] | undefined; go: (h: Href) => void }) {
  const look = FACT_LOOK()[kind] ?? { icon: 'note' as IconName, tint: colors.textSecondary, title: 'تفاصيل' };
  const list = items ?? [];
  const sum = list.reduce((n, i) => n + (i.amount ?? 0), 0);

  return (
    <View style={{ flexShrink: 1 }}>
      {/* Head: what this is, and how many. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: look.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={look.icon} size={20} color="#fff" />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{look.title}</Text>
        {list.length > 0 ? (
          <View style={{ minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, backgroundColor: look.tint + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: look.tint }}>{formatNumber(list.length)}</Text>
          </View>
        ) : null}
      </View>
      {/* Her sentence. */}
      <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderStartWidth: 3, borderStartColor: look.tint, padding: spacing.md }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary }}>{text}</Text>
      </View>

      {list.length > 0 ? (
        <ScrollView style={{ marginTop: spacing.md, maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {list.map((i, n) => (
            <TouchableOpacity key={n} disabled={!i.student_id} onPress={() => i.student_id && go(`/(teacher)/students/${i.student_id}` as Href)} activeOpacity={0.85}
              style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: look.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: look.tint }}>{(i.title || '؟').trim().charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{i.title}</Text>
                  {i.sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>{i.sub}</Text> : null}
                </View>
                {i.amount != null ? (
                  <View style={{ paddingHorizontal: 10, height: 28, borderRadius: radius.full, backgroundColor: (kind === 'dues' ? colors.danger : colors.success) + '1A', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: kind === 'dues' ? colors.danger : colors.success }}>{`${formatNumber(i.amount)} ج.م`}</Text>
                  </View>
                ) : null}
              </View>
              {(i.lines ?? []).length > 0 ? (
                <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight, gap: 5 }}>
                  {(i.lines ?? []).map((l, k) => (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: look.tint, marginTop: 8 }} />
                      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{l}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {i.student_id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-end', marginTop: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>صفحة الطالب</Text>
                  <Icon name="back" size={13} color={colors.brand} />
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
          {sum > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>الإجمالي</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{`${formatNumber(sum)} ج.م`}</Text>
            </View>
          ) : null}
        </ScrollView>
      ) : items === undefined && kind !== 'dues_clear' ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.md }}>التفاصيل هتظهر بعد تحديث الخادم.</Text>
      ) : null}

      {look.action ? (
        <TouchableOpacity onPress={() => go(look.action!.href)} activeOpacity={0.85} accessibilityRole="button"
          style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, backgroundColor: look.tint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{look.action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
