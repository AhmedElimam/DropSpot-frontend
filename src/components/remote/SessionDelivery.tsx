import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { Surface } from '@/ui/surfaces';
import { useRemoteSessionsEnabled, useSetGroupDelivery, useSetSessionDelivery } from '@/hooks/useRemoteSession';
import { remoteErrorSentence, type DeliveryChange } from '@/api/remoteSession';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber } from '@/utils/format';
import {
  deliveryAskKey, deliveryDoneKey, deliveryLabelKey, deliveryOf, deliveryScopeOptions, scopeHintKey, scopeLabelKey,
  showsDeliveryControl, showsOnlineChip, waitsForTeacher,
  type DeliveryScope, type SessionDelivery,
} from '@/remote/delivery';

/**
 * «حضوري / أونلاين» — how a session is held, said in advance from the schedule (founder
 * 2026-11-12). Four small pieces, each drawing nothing while «حصة أونلاين» is off:
 *
 *  · OnlineChip             — «أونلاين» on a session card or a group row;
 *  · SessionDeliveryControl — the teacher's session page: «الحصة: حضوري | أونلاين», and a
 *                             sheet asking how far the change goes;
 *  · GroupDeliveryControl   — the same choice where a group's schedule is edited (that group);
 *  · WaitsForTeacherLine    — a student's card for an online session not opened yet.
 *
 * Every decision is in src/remote/delivery.ts; the rules are the server's (it refuses a session
 * that is over, and going back to in person while the room is on air).
 */

const VALUES: SessionDelivery[] = ['in_person', 'remote'];

/**
 * «أونلاين» — a small chip on a session that is held online. `onColor`: on a gradient card
 * (white ink on a translucent pill). `size="sm"` matches the 11-point chips of the teacher's
 * card; the default matches the 12-point pills of the student's.
 */
export const OnlineChip = memo(function OnlineChip({ row, onColor = false, size = 'md', style }: {
  row: { delivery?: unknown; status?: string | null } | null | undefined;
  onColor?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  if (!showsOnlineChip(row, on)) return null;
  const sm = size === 'sm';
  // On a saturated gradient the ink is white in both schemes, like the other pills there.
  const ink = onColor ? '#fff' : colors.infoText;
  return (
    <View accessibilityLabel={t('remote.online_chip')}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: sm ? 3 : 5, backgroundColor: onColor ? 'rgba(255,255,255,0.16)' : colors.infoLight, borderRadius: radius.full, paddingVertical: sm ? 1 : 4, paddingHorizontal: sm ? 8 : 10 }, style]}>
      <Icon name="video" size={sm ? 11 : 13} color={ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: sm ? 11 : 12, color: ink }} numberOfLines={1}>{t('remote.online_chip')}</Text>
    </View>
  );
});

/** «حضوري | أونلاين» — the two-way switch both controls draw. The value in force is filled; the other is a tap away. */
function DeliveryPills({ value, busy, onPick }: { value: SessionDelivery; busy: boolean; onPick: (to: SessionDelivery) => void }) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, padding: 3 }}>
      {VALUES.map((v) => {
        const selected = v === value;
        return (
          <TouchableOpacity key={v} onPress={() => { if (!selected) onPick(v); }} disabled={busy} activeOpacity={0.8}
            accessibilityRole="radio" accessibilityState={{ selected, disabled: busy }} accessibilityLabel={t(deliveryLabelKey(v))} hitSlop={4}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: selected ? colors.brand : 'transparent', opacity: busy && !selected ? 0.5 : 1 }}>
            <Icon name={v === 'remote' ? 'video' : 'location'} size={14} color={selected ? colors.onPrimary : colors.textSecondary} outline={v !== 'remote' && !selected} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: selected ? colors.onPrimary : colors.textSecondary }} numberOfLines={1}>{t(deliveryLabelKey(v))}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** What is said once a change is done: what moved, how many sessions, and that the families were told once. */
function useDoneMessage(): (to: SessionDelivery, change: DeliveryChange) => string {
  const { t } = useTranslation();
  return useCallback((to, change) => {
    if (change.changed === 0 && change.groups === 0) return t('remote.delivery_done_none');
    return `${t(deliveryDoneKey(to, change.scope), { n: formatNumber(change.changed) })} ${t('remote.delivery_told')}`;
  }, [t]);
}

/**
 * The teacher's session page: «الحصة: حضوري | أونلاين». Choosing the other one opens a sheet
 * asking how far it goes — this session, the group's sessions from now on, or every group —
 * then the change is made and the result said. Drawn only while the feature is on, the row
 * carries `delivery`, and the session can still change (not cancelled, not over). The
 * teacher's alone: the server refuses an assistant.
 */
export const SessionDeliveryControl = memo(function SessionDeliveryControl({ sessionId, session, now, style }: {
  sessionId: string;
  session: { delivery?: unknown; status?: string | null; scheduled_at?: string | null; duration_minutes?: number | null; is_cancelled?: boolean; is_completed?: boolean };
  now: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const on = useRemoteSessionsEnabled();
  const change = useSetSessionDelivery(sessionId);
  const doneMessage = useDoneMessage();
  // The value the teacher asked for, and whether the sheet asking «how far» is up. Null until
  // its first opening: the sheet is never mounted for a page that did not need it. `to` stays
  // after closing, so the title does not change under the closing sheet.
  const [sheet, setSheet] = useState<{ to: SessionDelivery; open: boolean } | null>(null);

  const ask = useCallback((to: SessionDelivery) => setSheet({ to, open: true }), []);
  const shut = useCallback(() => setSheet((cur) => (cur ? { ...cur, open: false } : cur)), []);
  const close = useCallback(() => { if (!change.isPending) shut(); }, [change.isPending, shut]);
  const apply = useCallback((scope: DeliveryScope) => {
    if (!sheet?.open || change.isPending) return;
    const to = sheet.to;
    change.mutate({ delivery: to, scope }, {
      onSuccess: (result) => { shut(); Alert.alert('', doneMessage(to, result)); },
      onError: (e) => { shut(); Alert.alert(t('common.error'), remoteErrorSentence(e) ?? getFriendlyErrorMessage(e)); },
    });
  }, [change, doneMessage, sheet, shut, t]);

  if (!showsDeliveryControl(session, on, now)) return null;
  const value = deliveryOf(session.delivery);

  return (
    <Surface id="teacher.session.delivery" assistantNeeds="teacher">
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }, style]}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{t('remote.delivery_label')}</Text>
        <DeliveryPills value={value} busy={change.isPending} onPick={ask} />
      </View>
      {sheet ? (
        <SheetModal visible={sheet.open} onClose={close}>
          <View style={{ gap: spacing.sm, paddingBottom: insets.bottom }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.textPrimary }}>{t(deliveryAskKey(sheet.to))}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, marginBottom: spacing.xs }}>{t('remote.delivery_ask_sub')}</Text>
            {deliveryScopeOptions('session').map((scope) => {
              const running = change.isPending && change.variables?.scope === scope;
              return (
                <TouchableOpacity key={scope} onPress={() => apply(scope)} disabled={change.isPending} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t(scopeLabelKey(scope))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, opacity: change.isPending && !running ? 0.5 : 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    {running ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon name={scope === 'session' ? 'sessions' : scope === 'group' ? 'calendar' : 'list'} size={18} color={colors.brand} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{t(scopeLabelKey(scope))}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }} numberOfLines={2}>{t(scopeHintKey(scope))}</Text>
                  </View>
                  <Icon name="back" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={close} disabled={change.isPending} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </SheetModal>
      ) : null}
    </Surface>
  );
});

/**
 * Where a group's schedule is edited: «حصص المجموعة: حضوري | أونلاين». There is nothing to
 * choose about how far it goes — it is this group, its sessions from now on and the ones made
 * later — so the other value asks once and is done. Drawn only while the feature is on and the
 * group row carries `delivery`. The teacher's alone.
 */
export const GroupDeliveryControl = memo(function GroupDeliveryControl({ courseId, scheduleId, delivery, style }: {
  courseId: string;
  scheduleId: string;
  delivery: unknown;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  const change = useSetGroupDelivery(courseId);
  const doneMessage = useDoneMessage();

  const ask = useCallback((to: SessionDelivery) => {
    Alert.alert(t(to === 'remote' ? 'remote.group_ask_remote' : 'remote.group_ask_in_person'), t('remote.group_ask_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('remote.delivery_confirm_cta'),
        onPress: () => {
          change.mutate({ scheduleId, delivery: to }, {
            onSuccess: (result) => Alert.alert('', doneMessage(to, result)),
            onError: (e) => Alert.alert(t('common.error'), remoteErrorSentence(e) ?? getFriendlyErrorMessage(e)),
          });
        },
      },
    ]);
  }, [change, doneMessage, scheduleId, t]);

  if (!on || (delivery !== 'remote' && delivery !== 'in_person')) return null;

  return (
    <Surface id="teacher.course_detail.slots.delivery" assistantNeeds="teacher">
      <View style={[{ gap: spacing.xs }, style]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={1}>{t('remote.group_delivery_label')}</Text>
          {change.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : null}
          <DeliveryPills value={deliveryOf(delivery)} busy={change.isPending} onPick={ask} />
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{t('remote.group_delivery_hint')}</Text>
      </View>
    </Surface>
  );
});

/**
 * «الحصة دي أونلاين — هتبدأ لما المدرّس يفتحها» — on a student's card for an online session
 * its teacher has not opened yet, in place of the door's check-in. Gone the moment the class
 * is on air (the «ادخل» button takes its place) or the student has an outcome.
 */
export const WaitsForTeacherLine = memo(function WaitsForTeacherLine({ session, now, onColor = false, style }: {
  session: Parameters<typeof waitsForTeacher>[0];
  now: number;
  onColor?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  if (!waitsForTeacher(session, on, now)) return null;
  const ink = onColor ? '#fff' : colors.infoText;
  return (
    <Surface id="student.session.remote_waiting">
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: onColor ? 'rgba(255,255,255,0.16)' : colors.infoLight, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }, style]}>
        <Icon name="video" size={16} color={ink} />
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: ink }}>{t('remote.waits_for_teacher')}</Text>
      </View>
    </Surface>
  );
});
