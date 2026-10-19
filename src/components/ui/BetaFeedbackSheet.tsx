import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { sendFeatureFeedback, type FeedbackMood } from '@/api/featureFeedback';
import { getFriendlyErrorMessage } from '@/utils/errors';

const MOODS: { key: FeedbackMood; icon: IconName; tone: () => { fg: string; bg: string } }[] = [
  { key: 'works', icon: 'thumbUp', tone: () => ({ fg: colors.success, bg: colors.successLight }) },
  { key: 'issue', icon: 'warning', tone: () => ({ fg: colors.warning, bg: colors.warningLight }) },
  { key: 'idea', icon: 'note', tone: () => ({ fg: colors.info, bg: colors.infoLight }) },
];

/** A problem or an idea needs its sentence; «it works» is a whole answer (the server asks the same). */
export const MIN_NOTE = 5;

export function canSendFeedback(mood: FeedbackMood | null, note: string): boolean {
  if (!mood) return false;
  return mood === 'works' || note.trim().length >= MIN_NOTE;
}

/** Where this person reads the platform's reply: their «مراسلة الإدارة». */
export function supportHref(role: string | null | undefined): Href {
  if (role === 'parent') return '/(parent)/support' as Href;
  if (role === 'student') return '/(student)/support' as Href;
  return '/(teacher)/resolution' as Href;
}

/**
 * «رأيك يهمّنا», answered in place (founder 2026-10-19: the line used to open the teacher's
 * tickets screen — the parents' channel, where nothing can be sent to the platform). One
 * tap for how it went, a sentence, send; the note reaches the /ops queue and the reply
 * comes back in «مراسلة الإدارة».
 */
export function BetaFeedbackSheet({ feature, visible, onClose }: { feature: string; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const [mood, setMood] = useState<FeedbackMood | null>(null);
  const [note, setNote] = useState('');

  const send = useMutation({
    mutationFn: () => sendFeatureFeedback({ feature, mood: mood as FeedbackMood, message: note.trim() || undefined }),
  });
  const close = () => {
    onClose();
    // Ready for the next note once the sheet is gone.
    if (send.isSuccess) { setMood(null); setNote(''); send.reset(); }
  };
  const name = t(`beta.feature_names.${feature}`, { defaultValue: t('beta.feature_names.default') });

  return (
    <SheetModal visible={visible} onClose={close} avoidKeyboard>
      {send.isSuccess ? (
        <View testID="beta-feedback-sent" style={{ alignItems: 'center', paddingVertical: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="success" size={32} color={colors.success} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 28, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>{t('beta.sent_title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginTop: 4, textAlign: 'center' }}>{t('beta.sent_sub')}</Text>
          <Button title={t('beta.done')} onPress={close} style={{ alignSelf: 'stretch', marginTop: spacing.lg }} />
          <Button title={t('beta.open_support')} variant="ghost" onPress={() => { close(); router.push(supportHref(role)); }} style={{ alignSelf: 'stretch', marginTop: spacing.sm }} />
        </View>
      ) : (
        <View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, lineHeight: 28, color: colors.textPrimary }}>{t('beta.sheet_title', { name })}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, marginTop: 2 }}>{t('beta.sheet_sub')}</Text>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
            {MOODS.map((m) => {
              const on = mood === m.key;
              const tone = m.tone();
              return (
                <TouchableOpacity key={m.key} testID={`beta-mood-${m.key}`} onPress={() => setMood(m.key)} activeOpacity={0.85}
                  accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ flex: 1, minHeight: 84, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4,
                    backgroundColor: on ? tone.bg : colors.surface, borderWidth: on ? 2 : 1, borderColor: on ? tone.fg : colors.border }}>
                  <Icon name={m.icon} size={24} color={on ? tone.fg : colors.textTertiary} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: on ? tone.fg : colors.textSecondary }} numberOfLines={1} adjustsFontSizeToFit>{t(`beta.mood_${m.key}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {mood ? (
            <Input
              testID="beta-feedback-note"
              multiline
              value={note}
              onChangeText={setNote}
              maxLength={2000}
              placeholder={t(`beta.note_${mood}`)}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
          {send.isError ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger, marginTop: spacing.sm }}>{getFriendlyErrorMessage(send.error)}</Text> : null}
          <Button title={t('beta.send')} onPress={() => send.mutate()} loading={send.isPending} disabled={!canSendFeedback(mood, note)} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </SheetModal>
  );
}
