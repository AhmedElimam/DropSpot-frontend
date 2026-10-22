import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { dayLabel, formatTime, formatNumber } from '@/utils/format';
import { useSessionDetail, useSessionControls } from '@/hooks/useTeacherSessionHistory';

const MAX = 1000;

/**
 * «ملاحظات الحصة» straight from the home card's swipe (founder 2026-10-22: «the notes modal
 * should show on the home page»): the session's note in a sheet over home — write or edit it
 * while the window is open, or reopen it for 48 hours once it closed. Mounted only while a
 * session is chosen, so its queries run for that one session.
 */
export function SessionNotesSheet({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  return (
    <SheetModal visible={!!sessionId} onClose={onClose} avoidKeyboard style={{ backgroundColor: colors.background }}>
      {sessionId ? <Body key={sessionId} id={sessionId} onClose={onClose} /> : null}
    </SheetModal>
  );
}

function Body({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: s, isLoading } = useSessionDetail(id);
  const controls = useSessionControls(id);
  const [draft, setDraft] = useState<string | null>(null);

  // The draft starts from what is written, once the session has loaded.
  useEffect(() => {
    if (s && draft === null) setDraft(s.summary?.body ?? '');
  }, [s, draft]);

  const win = s?.notes_window;
  const body = s?.summary?.body ?? '';
  const closes = win?.closes_at ? `${dayLabel(win.closes_at)} ${formatTime(win.closes_at)}` : '';
  const fail = (e: unknown) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
  const save = () => controls.summary.mutate((draft ?? '').trim(), { onSuccess: onClose, onError: fail });
  const reopen = () => controls.reopen.mutate(undefined, { onError: fail });

  return (
    <View style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="note" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{t('session_notes.card_title')}</Text>
          {s ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }} numberOfLines={1}>
              {[s.course_name, s.scheduled_at ? `${dayLabel(s.scheduled_at)}${s.time ? ` · ${s.time}` : ''}` : null].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
      </View>

      {isLoading || !s ? (
        <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} />
      ) : !win ? (
        // An older server sends no window: say it plainly rather than an empty editor.
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{t('session_notes.not_available')}</Text>
      ) : win.state === 'open' ? (
        <>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('session_notes.open_until', { when: closes })}</Text>
          <TextInput value={draft ?? ''} onChangeText={setDraft} multiline maxLength={MAX} autoFocus
            placeholder={t('session_notes.placeholder')} placeholderTextColor={colors.textTertiary}
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, minHeight: 130, maxHeight: 260, fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textPrimary, textAlignVertical: 'top' }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary, marginTop: 4, alignSelf: 'flex-end' }}>{`${formatNumber((draft ?? '').length)}/${formatNumber(MAX)}`}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: spacing.sm }}>{t('session_notes.editor_hint')}</Text>
          <View style={{ marginTop: spacing.md }}>
            <Button title={t('session_notes.save')} onPress={save} loading={controls.summary.isPending} disabled={!(draft ?? '').trim() && !body} />
          </View>
        </>
      ) : win.state === 'closed' ? (
        <>
          {body ? (
            <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textPrimary }}>{body}</Text>
            </View>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{t('session_notes.closed_auto', { hours: formatNumber(win.hours) })}</Text>
          <TouchableOpacity onPress={reopen} disabled={controls.reopen.isPending} activeOpacity={0.85} accessibilityRole="button"
            style={{ marginTop: spacing.md, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: controls.reopen.isPending ? 0.7 : 1 }}>
            {controls.reopen.isPending ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="refresh" size={18} color={colors.onPrimary} />}
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('session_notes.reopen_48')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>
          {t(win.state === 'upcoming' ? 'session_notes.child_upcoming' : 'session_notes.cancelled')}
        </Text>
      )}
    </View>
  );
}
