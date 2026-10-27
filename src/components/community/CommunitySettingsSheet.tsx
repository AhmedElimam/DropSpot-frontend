import { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Button } from '@/components/ui/Button';
import { Choice, Sheet, threadInputStyle } from '@/components/threads/ThreadSheets';
import { useCommunitySettings, useUpdateCommunitySettings } from '@/hooks/useCommunity';
import { getFriendlyErrorMessage } from '@/utils/errors';

/** The teacher's switches for their community (docs/COMMUNITY.md «Settings»). */
export function CommunitySettingsSheet({ visible, teacherId, onClose }: { visible: boolean; teacherId: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { data } = useCommunitySettings(teacherId, visible);
  const save = useUpdateCommunitySettings(teacherId);
  const [students, setStudents] = useState(true);
  const [parents, setParents] = useState(true);
  const [comments, setComments] = useState(true);
  const [reviewStudents, setReviewStudents] = useState<'screen' | 'approve'>('screen');
  const [reviewParents, setReviewParents] = useState<'screen' | 'approve'>('screen');
  const [words, setWords] = useState('');
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    if (data && visible) {
      setStudents(data.students_can_post); setParents(data.parents_can_post); setComments(data.comments_on);
      setReviewStudents(data.review_students); setReviewParents(data.review_parents);
      setWords(data.flag_words.join('\n')); setWelcome(data.welcome ?? '');
    }
  }, [data, visible]);

  const Row = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand, false: colors.border }} />
    </View>
  );

  const submit = () => {
    save.mutate({ students_can_post: students, parents_can_post: parents, comments_on: comments, review_students: reviewStudents, review_parents: reviewParents, flag_words: words.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean), welcome: welcome.trim() || null }, {
      onSuccess: onClose,
      onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)),
    });
  };

  return (
    <Sheet visible={visible} title={t('community_space.settings')} subtitle={t('community_space.settings_sub')} icon="settings" onClose={onClose} busy={save.isPending}>
      <Row label={t('community_space.students_can_post')} value={students} onChange={setStudents} />
      <Row label={t('community_space.parents_can_post')} value={parents} onChange={setParents} />
      <Row label={t('community_space.comments_on')} value={comments} onChange={setComments} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('community_space.review_students')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Choice label={t('community_space.review_screen')} sub={t('community_space.review_screen_sub')} active={reviewStudents === 'screen'} onPress={() => setReviewStudents('screen')} />
        <Choice label={t('community_space.review_approve')} sub={t('community_space.review_approve_sub')} active={reviewStudents === 'approve'} onPress={() => setReviewStudents('approve')} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('community_space.review_parents')}</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Choice label={t('community_space.review_screen')} active={reviewParents === 'screen'} onPress={() => setReviewParents('screen')} />
        <Choice label={t('community_space.review_approve')} active={reviewParents === 'approve'} onPress={() => setReviewParents('approve')} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('community_space.flag_words')}</Text>
      <TextInput value={words} onChangeText={setWords} placeholder={t('community_space.flag_words_hint')} placeholderTextColor={colors.textTertiary} multiline style={[threadInputStyle(), { minHeight: 64, textAlignVertical: 'top' }]} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('community_space.welcome')}</Text>
      <TextInput value={welcome} onChangeText={setWelcome} placeholder={t('community_space.welcome_hint')} placeholderTextColor={colors.textTertiary} maxLength={500} multiline style={[threadInputStyle(), { minHeight: 64, textAlignVertical: 'top' }]} />
      <Button title={t('community_space.save')} onPress={submit} loading={save.isPending} disabled={save.isPending || !data} />
    </Sheet>
  );
}
