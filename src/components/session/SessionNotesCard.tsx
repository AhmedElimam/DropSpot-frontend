import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
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
import { dayLabel, formatTime, formatNumber } from '@/utils/format';
import type { SessionDetail } from '@/api/teacherSessions';

const MAX = 1000;

/**
 * «ملاحظات الحصة» on the teacher's session sheet (founder 2026-10-22): one note to the whole
 * session — what was covered, what to bring — that its students and their parents read in
 * their app, reported by الناظر. Writable from the start until 48 hours after the end; then
 * it closes by itself and one tap reopens it for 48 hours more. Nothing before the start,
 * nothing on a cancelled session.
 */
export function SessionNotesCard({ s, save, reopen, autoOpen = false }: {
  s: SessionDetail;
  /** Open the editor as soon as the notes are open (the home card's swipe). Once per mount. */
  autoOpen?: boolean;
  save: UseMutationResult<SessionDetail, Error, string>;
  reopen: UseMutationResult<SessionDetail, Error, void>;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const win = s.notes_window;
  const opened = useRef(false);
  useEffect(() => {
    if (!autoOpen || opened.current || win?.state !== 'open') return;
    opened.current = true;
    setDraft(s.summary?.body ?? '');
    setEditing(true);
  }, [autoOpen, win?.state, s.summary?.body]);
  if (!win || win.state === 'upcoming' || win.state === 'cancelled') return null;

  const body = s.summary?.body ?? '';
  const open = win.state === 'open';
  const closes = win.closes_at ? `${dayLabel(win.closes_at)} ${formatTime(win.closes_at)}` : '';

  const edit = () => { setDraft(body); setEditing(true); };
  const submit = () => save.mutate(draft.trim(), {
    onSuccess: () => setEditing(false),
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });
  const doReopen = () => reopen.mutate(undefined, { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) });

  return (
    <>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: open && !body ? colors.brand : colors.border, padding: spacing.md, ...shadows.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: open ? colors.brandTint : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="note" size={20} color={open ? colors.brand : colors.textTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('session_notes.card_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>
              {open ? t('session_notes.open_until', { when: closes }) : t('session_notes.closed_auto', { hours: formatNumber(win.hours) })}
            </Text>
          </View>
          {open ? (
            <TouchableOpacity onPress={edit} activeOpacity={0.85} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: body ? colors.surfaceSunken : colors.brand, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: spacing.md }}>
              <Icon name="note" size={14} color={body ? colors.textPrimary : colors.onPrimary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: body ? colors.textPrimary : colors.onPrimary }}>{t(body ? 'session_notes.edit' : 'session_notes.write')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={doReopen} disabled={reopen.isPending} activeOpacity={0.85} accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: spacing.md, opacity: reopen.isPending ? 0.6 : 1 }}>
              <Icon name="refresh" size={14} color={colors.brand} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('session_notes.reopen')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {body ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary, marginTop: spacing.sm }} numberOfLines={3}>{body}</Text>
        ) : open ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textTertiary, marginTop: spacing.sm }}>{t('session_notes.empty_hint')}</Text>
        ) : null}
      </View>

      <SheetModal visible={editing} onClose={() => setEditing(false)} avoidKeyboard style={{ backgroundColor: colors.background, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('session_notes.card_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md }}>{t('session_notes.editor_hint')}</Text>
        <TextInput value={draft} onChangeText={setDraft} multiline maxLength={MAX} autoFocus
          placeholder={t('session_notes.placeholder')} placeholderTextColor={colors.textTertiary}
          style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 130, maxHeight: 260, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textPrimary, textAlignVertical: 'top' }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4, alignSelf: 'flex-end' }}>{`${formatNumber(draft.length)}/${formatNumber(MAX)}`}</Text>
        <View style={{ marginTop: spacing.md }}>
          <Button title={t('session_notes.save')} onPress={submit} loading={save.isPending} disabled={!draft.trim() && !body} />
        </View>
      </SheetModal>
    </>
  );
}
