import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UseMutationResult } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatDayDate, formatNumber } from '@/utils/format';
import { RATING_TONE } from '@/components/homework/HomeworkChips';
import { HOMEWORK_RATINGS, homeworkDay, type HomeworkRating } from '@/api/homework';
import type { SessionDetail } from '@/api/teacherSessions';

const MAX = 500;

/**
 * «الواجب» on the teacher's session sheet (founder 2026-11-03), two parts: the homework given
 * at THIS session (its students read it in their app), and the previous session's homework,
 * graded here — each student from their row's chips, or the attending ones at once with
 * «الكل حلّ». Nothing on an older server; nothing to write on a cancelled session.
 */
export function SessionHomeworkCard({ s, save, rateAll }: {
  s: SessionDetail;
  save: UseMutationResult<SessionDetail, Error, string>;
  rateAll: UseMutationResult<SessionDetail, Error, HomeworkRating>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (s.can_edit_homework === undefined) return null;
  const canEdit = s.can_edit_homework;
  const due = s.homework_due ?? null;
  if (!canEdit && !due) return null;

  const body = s.homework?.body ?? '';
  const edit = () => { setDraft(body); setEditing(true); };
  const submit = () => save.mutate(draft.trim(), {
    onSuccess: () => setEditing(false),
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const allDone = () => Alert.alert(t('homework.all_done_title'), t('homework.all_done_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('homework.all_done_confirm'), onPress: () => rateAll.mutate('done', { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) }) },
  ]);

  return (
    <>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md, ...shadows.sm }}>
        {canEdit ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="list" size={20} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('homework.given_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t('homework.given_sub')}</Text>
              </View>
              <TouchableOpacity onPress={edit} activeOpacity={0.85} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: body ? colors.surfaceSunken : colors.brand, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: spacing.md }}>
                <Icon name="note" size={14} color={body ? colors.textPrimary : colors.onPrimary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: body ? colors.textPrimary : colors.onPrimary }}>{t(body ? 'homework.edit' : 'homework.write')}</Text>
              </TouchableOpacity>
            </View>
            {body ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary, marginTop: spacing.sm }} numberOfLines={4}>{body}</Text>
            ) : (
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textTertiary, marginTop: spacing.sm }}>{t('homework.given_empty')}</Text>
            )}
          </View>
        ) : null}

        {due ? (
          <View style={canEdit ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="success" size={20} color={colors.successText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('homework.due_title')}</Text>
                {due.session_date ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{t('homework.given_on', { date: formatDayDate(homeworkDay(due.session_date)) })}</Text>
                ) : null}
              </View>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary, marginTop: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.sm }} numberOfLines={4}>{due.body}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
              {HOMEWORK_RATINGS.map((r) => {
                const tone = RATING_TONE()[r];
                return <Count key={r} n={due.counts[r] ?? 0} label={t(`homework.rating.${r}`)} bg={tone.bg} fg={tone.ink} />;
              })}
              <Count n={due.counts.ungraded ?? 0} label={t('homework.ungraded_count')} bg={colors.surfaceSunken} fg={colors.textSecondary} />
            </View>
            {canEdit ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary }}>{t('homework.grade_hint')}</Text>
                {(due.counts.ungraded ?? 0) > 0 ? (
                  <TouchableOpacity onPress={allDone} disabled={rateAll.isPending} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, backgroundColor: colors.successLight, borderRadius: radius.full, paddingHorizontal: spacing.md, opacity: rateAll.isPending ? 0.6 : 1 }}>
                    {rateAll.isPending ? <ActivityIndicator size="small" color={colors.successText} /> : <Icon name="success" size={16} color={colors.successText} />}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.successText }}>{t('homework.all_done')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <SheetModal visible={editing} onClose={() => setEditing(false)} avoidKeyboard style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('homework.given_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>{t('homework.editor_hint')}</Text>
        <TextInput value={draft} onChangeText={setDraft} multiline maxLength={MAX} autoFocus
          placeholder={t('homework.placeholder')} placeholderTextColor={colors.textTertiary}
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 110, maxHeight: 220, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textPrimary, textAlignVertical: 'top' }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4, alignSelf: 'flex-end' }}>{`${formatNumber(draft.length)}/${formatNumber(MAX)}`}</Text>
        <View style={{ marginTop: spacing.md }}>
          {/* Saving an emptied field takes the homework back. */}
          <Button title={t(!draft.trim() && body ? 'homework.clear' : 'homework.save')} onPress={submit} loading={save.isPending} disabled={!draft.trim() && !body} variant={!draft.trim() && body ? 'destructive' : 'primary'} />
        </View>
      </SheetModal>
    </>
  );
}

function Count({ n, label, bg, fg }: { n: number; label: string; bg: string; fg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: fg }}>{formatNumber(n)}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: fg }}>{label}</Text>
    </View>
  );
}
