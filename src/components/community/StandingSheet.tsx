import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Sheet, threadInputStyle } from '@/components/threads/ThreadSheets';
import { Alert } from '@/ui/dialog';
import { formatDateOnly } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useAppealCommunityStrike, useCommunityStanding } from '@/hooks/useCommunity';
import type { CommunityStrike } from '@/api/community';

const DAY = { day: 'numeric', month: 'long' } as const;

/**
 * «إنذاراتي» — the viewer's own warnings and suspensions, private between them and the
 * platform's team (the guard-rails spec, Part C: never announced, never shown to classmates).
 * A parent also sees each child's («إنذارات أبنائي»). Any step can be appealed; an accepted
 * appeal stops it counting. A short list (the ladder has six steps): plain rows, no scroller.
 */
export function StandingSheet({ visible, parent, onClose }: { visible: boolean; parent: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const standing = useCommunityStanding(visible);
  const appeal = useAppealCommunityStrike();
  const [appealing, setAppealing] = useState<number | null>(null);
  const [text, setText] = useState('');
  useEffect(() => { if (!visible) { setAppealing(null); setText(''); } }, [visible]);

  const send = () => {
    if (appealing === null || !text.trim()) return;
    appeal.mutate({ strikeId: appealing, body: text.trim() }, {
      onSuccess: () => { setAppealing(null); setText(''); Alert.alert(t('community_space.appeal_sent_title'), t('community_space.appeal_sent_body')); },
      onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
    });
  };

  const row = (s: CommunityStrike) => {
    const suspension = s.level !== 'warning_1' && s.level !== 'warning_2';
    const appealLine = s.appeal ? t(`community_space.appeal_${s.appeal.status}`) : null;
    return (
      <View key={s.id} style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, opacity: s.counting ? 1 : 0.7, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={suspension ? 'lock' : 'info'} size={15} color={suspension ? colors.warningText : colors.textSecondary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t(`community_space.level_${s.level}`)}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{formatDateOnly(s.created_at, DAY)}</Text>
        </View>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>{s.reason_label}</Text>
        {s.ends_at ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{t('community_space.strike_until', { date: formatDateOnly(s.ends_at, DAY) })}</Text> : null}
        {!s.counting ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('community_space.strike_faded')}</Text> : null}
        {appealLine ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: s.appeal?.status === 'accepted' ? colors.success : colors.textSecondary }}>
            {appealLine}{s.appeal?.note ? ` — ${s.appeal.note}` : ''}
          </Text>
        ) : null}
        {s.can_appeal && appealing !== s.id ? (
          <TouchableOpacity onPress={() => { setAppealing(s.id); setText(''); }} activeOpacity={0.8} accessibilityRole="button"
            style={{ alignSelf: 'flex-start', marginTop: 4, height: 32, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.brandTint, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('community_space.appeal')}</Text>
          </TouchableOpacity>
        ) : null}
        {appealing === s.id ? (
          <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
            <TextInput value={text} onChangeText={setText} placeholder={t('community_space.appeal_placeholder')} placeholderTextColor={colors.textTertiary}
              maxLength={1000} multiline autoFocus style={[threadInputStyle(), { minHeight: 80, textAlignVertical: 'top' }]} />
            <Button title={t('community_space.appeal_send')} onPress={send} disabled={!text.trim() || appeal.isPending} loading={appeal.isPending} />
          </View>
        ) : null}
      </View>
    );
  };

  const mine = standing.data?.me.strikes ?? [];
  const children = standing.data?.children ?? [];
  const quiet = (key: string) => <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', marginVertical: spacing.md }}>{t(key)}</Text>;

  return (
    <Sheet visible={visible} title={t('community_space.standing_mine')} subtitle={t('community_space.standing_hint')} icon="shield" tone="brand" onClose={onClose} busy={appeal.isPending}>
      {standing.isLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} /> : (
        <View style={{ gap: spacing.sm }}>
          {mine.length ? mine.map(row) : quiet('community_space.standing_empty')}
          {parent ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('community_space.standing_children')}</Text>
              {children.some((c) => c.strikes.length) ? children.filter((c) => c.strikes.length).map((c) => (
                <View key={c.student_id} style={{ gap: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textSecondary }}>{c.name}</Text>
                  {c.strikes.map(row)}
                </View>
              )) : quiet('community_space.standing_children_empty')}
            </View>
          ) : null}
        </View>
      )}
    </Sheet>
  );
}
