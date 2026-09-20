import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Countdown } from './Countdown';
import { timeAgo } from '@/utils/format';
import type { Thread } from '@/api/threads';

/**
 * One post in the feed. The state chip is the whole story at a glance: a running clock while
 * the round is open, «انتهى الوقت / مقفول» while the teacher's answer is awaited, «أُجيب» once
 * it landed. The left edge carries the same colour so a column of cards scans by state.
 */
export const ThreadCard = memo(function ThreadCard({ thread: t, onOpen, showTeacher }: { thread: Thread; onOpen: (id: number) => void; showTeacher: boolean }) {
  const { t: tr } = useTranslation();
  const state = stateOf(t);
  const accent = state === 'open' ? colors.brand : state === 'answered' ? colors.success : state === 'note' ? colors.accentWarm : colors.warning;

  return (
    <TouchableOpacity
      onPress={() => onOpen(t.id)}
      activeOpacity={0.75}
      style={{
        backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: t.unread ? colors.brand : colors.border,
        padding: spacing.lg, borderStartWidth: 4, borderStartColor: accent, ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
          <Icon name="teacher" size={12} color={colors.textTertiary} outline />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t.grade.name ?? '—'}</Text>
        </View>
        {showTeacher ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>
            {tr('threads.by_teacher', { name: t.teacher.name })}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {t.unread ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.brand }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{tr('threads.new_badge')}</Text>
          </View>
        ) : null}
      </View>

      <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 26, color: colors.textPrimary, textAlign: 'right' }} numberOfLines={3}>
        {t.title ?? t.body ?? tr('threads.video_badge')}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
        <StateChip thread={t} state={state} />
        {t.kind === 'question' ? (
          <Meta icon="chat" text={tr('threads.answers_count', { count: t.comments_count })} />
        ) : null}
        {t.video || t.answer?.video ? <Meta icon="video" text={tr('threads.video_badge')} /> : null}
        {t.reveal_at_close ? <Meta icon="eyeOff" text={tr('threads.quiz_badge')} /> : null}
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{timeAgo(t.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
});

export type ThreadState = 'open' | 'timer' | 'locked' | 'answered' | 'note';

export function stateOf(t: Thread): ThreadState {
  if (t.kind !== 'question') return 'note';
  if (t.answered_at) return 'answered';
  if (t.open) return 'open';
  return t.closed_reason === 'locked' ? 'locked' : 'timer';
}

export function StateChip({ thread: t, state, large }: { thread: Thread; state: ThreadState; large?: boolean }) {
  const { t: tr } = useTranslation();
  const size = large ? 14 : 12;
  const pad = large ? spacing.md : spacing.sm;
  const chip = (bg: string, ink: string, icon: Parameters<typeof Icon>[0]['name'], body: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: pad, paddingVertical: large ? 6 : 3, borderRadius: radius.full, backgroundColor: bg }}>
      <Icon name={icon} size={size + 2} color={ink} />
      {body}
    </View>
  );
  const label = (text: string, ink: string) => <Text style={{ fontFamily: fonts.medium, fontSize: size, color: ink }}>{text}</Text>;

  switch (state) {
    case 'open':
      return chip(colors.brandTint, colors.brandDeep, 'timer', t.comments_close_at
        ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>{label(tr('threads.open_until'), colors.brandDeep)}<Countdown endsAt={t.comments_close_at} style={{ fontSize: size, color: colors.brandDeep }} /></View>
        : label(tr('threads.open_no_timer'), colors.brandDeep));
    case 'answered':
      return chip(colors.successLight, colors.successText, 'success', label(tr('threads.closed_answered'), colors.successText));
    case 'locked':
      return chip(colors.warningLight, colors.warningText, 'lock', label(tr('threads.closed_locked'), colors.warningText));
    case 'timer':
      return chip(colors.warningLight, colors.warningText, 'clock', label(tr('threads.closed_timer'), colors.warningText));
    default:
      return chip(colors.accentWarmTint, colors.onAccent, 'lightbulb', label(tr('threads.note_badge'), colors.onAccent));
  }
}

function Meta({ icon, text }: { icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon name={icon} size={13} color={colors.textTertiary} outline />
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{text}</Text>
    </View>
  );
}
