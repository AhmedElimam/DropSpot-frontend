import { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UseMutationResult } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
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
 * graded here like a quiz (جيد / مقبول / ضعيف / لم يحلّ) — each student from their row's chips,
 * or the attending ones at once with «الكل جيد». When nothing was recorded last time (the first
 * week) the previous session's homework can be written from here and graded at once.
 * Nothing on an older server; nothing to write on a cancelled session.
 */
export function SessionHomeworkCard({ s, save, saveDue, rateAll }: {
  s: SessionDetail;
  save: UseMutationResult<SessionDetail, Error, string>;
  /** Writes the previous session's homework from here when nothing was recorded then. */
  saveDue: UseMutationResult<SessionDetail, Error, string>;
  rateAll: UseMutationResult<SessionDetail, Error, HomeworkRating>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Which homework the editor writes: this session's, or the previous one's (to grade it now).
  const [editing, setEditing] = useState<'given' | 'previous' | null>(null);
  const [draft, setDraft] = useState('');
  if (s.can_edit_homework === undefined) return null;
  const canEdit = s.can_edit_homework;
  const due = s.homework_due ?? null;
  const previous = !due && canEdit ? s.homework_previous ?? null : null;
  if (!canEdit && !due) return null;

  const body = s.homework?.body ?? '';
  const edit = () => { setDraft(body); setEditing('given'); };
  const writePrevious = () => { setDraft(''); setEditing('previous'); };
  const mutation = editing === 'previous' ? saveDue : save;
  const submit = () => mutation.mutate(draft.trim(), {
    onSuccess: () => setEditing(null),
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const allGood = () => Alert.alert(t('homework.all_done_title'), t('homework.all_done_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('homework.all_done_confirm'), onPress: () => rateAll.mutate('good', { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) }) },
  ]);

  return (
    <>
      {/* Compact on purpose (founder 2026-11-03: «it swallows the page»): one line for this
          session's homework, one for the grading, one for the counts. The full text is in the editor. */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: 6 }}>
        {canEdit ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="list" size={16} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{t('homework.given_title')}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: body ? colors.textSecondary : colors.textTertiary }} numberOfLines={1}>
              {body || t('homework.given_empty_short')}
            </Text>
            <Pill label={t(body ? 'homework.edit' : 'homework.write')} onPress={edit} strong={!body} />
          </View>
        ) : null}

        {/* Nothing recorded last time (the first week): write it now, then grade it here. */}
        {previous ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="note" size={16} color={colors.warningText} />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
              {t('homework.previous_short', { date: previous.session_date ? formatDayDate(homeworkDay(previous.session_date)) : '' })}
            </Text>
            <Pill label={t('homework.previous_write')} onPress={writePrevious} strong />
          </View>
        ) : null}

        {due ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Icon name="success" size={16} color={colors.successText} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t(due.same_session ? 'homework.due_title_same' : 'homework.due_title_short')}</Text>
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }} numberOfLines={1}>
                {due.same_session ? '' : due.body}
              </Text>
              {canEdit && (due.counts.ungraded ?? 0) > 0 ? (
                <TouchableOpacity onPress={allGood} disabled={rateAll.isPending} activeOpacity={0.85} accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, backgroundColor: colors.successLight, borderRadius: radius.full, paddingHorizontal: spacing.sm, opacity: rateAll.isPending ? 0.6 : 1 }}>
                  {rateAll.isPending ? <ActivityIndicator size="small" color={colors.successText} /> : <Icon name="success" size={14} color={colors.successText} />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.successText }}>{t('homework.all_done')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {HOMEWORK_RATINGS.map((r) => {
                const tone = RATING_TONE()[r];
                return <Count key={r} n={due.counts[r] ?? 0} label={t(`homework.rating.${r}`)} bg={tone.bg} fg={tone.ink} />;
              })}
              <Count n={due.counts.ungraded ?? 0} label={t('homework.ungraded_count')} bg={colors.surfaceSunken} fg={colors.textSecondary} />
            </View>
          </>
        ) : null}
      </View>

      <SheetModal visible={editing !== null} onClose={() => setEditing(null)} avoidKeyboard style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t(editing === 'previous' ? 'homework.previous_title' : 'homework.given_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>{t(editing === 'previous' ? 'homework.previous_hint' : 'homework.editor_hint')}</Text>
        <TextInput value={draft} onChangeText={setDraft} multiline maxLength={MAX} autoFocus
          placeholder={t('homework.placeholder')} placeholderTextColor={colors.textTertiary}
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 110, maxHeight: 220, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textPrimary, textAlignVertical: 'top' }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4, alignSelf: 'flex-end' }}>{`${formatNumber(draft.length)}/${formatNumber(MAX)}`}</Text>
        <View style={{ marginTop: spacing.md }}>
          {/* Saving an emptied field takes the homework back. */}
          {editing === 'previous' ? (
            <Button title={t('homework.previous_write')} onPress={submit} loading={saveDue.isPending} disabled={!draft.trim()} variant="primary" />
          ) : (
            <Button title={t(!draft.trim() && body ? 'homework.clear' : 'homework.save')} onPress={submit} loading={save.isPending} disabled={!draft.trim() && !body} variant={!draft.trim() && body ? 'destructive' : 'primary'} />
          )}
        </View>
      </SheetModal>
    </>
  );
}

function Count({ n, label, bg, fg }: { n: number; label: string; bg: string; fg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: bg, borderRadius: radius.full, paddingVertical: 1, paddingHorizontal: 8 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: fg }}>{formatNumber(n)}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: fg }}>{label}</Text>
    </View>
  );
}

function Pill({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button" hitSlop={6}
      style={{ minHeight: 32, justifyContent: 'center', backgroundColor: strong ? colors.brand : colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: strong ? colors.onPrimary : colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}
