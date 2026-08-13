import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { usePendingSurvey, useMarkSurveyShown, useRespondSurvey } from '@/hooks/useSurvey';

/**
 * App-open/login survey prompt. Interrupts with a modal (unlike the passive
 * notification list) and answers into the same server record the web modal uses,
 * so a survey shows once across platforms and re-shows until answered. "Later"
 * just closes it for this session — it returns on the next app-open until answered.
 */
export function SurveyModal() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: survey } = usePendingSurvey();
  const markShown = useMarkSurveyShown();
  const respond = useRespondSurvey();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const beaconedId = useRef<string | null>(null);

  const visible = !!survey && dismissedId !== survey.id;

  // Reset per-survey answer state when a different survey surfaces.
  useEffect(() => {
    if (survey) setAnswers({});
  }, [survey?.id]);

  // Mark "shown" once the modal is actually visible on screen — a distinct call,
  // fired at most once per survey id.
  useEffect(() => {
    if (visible && survey && beaconedId.current !== survey.id) {
      beaconedId.current = survey.id;
      markShown.mutate(survey.id);
    }
  }, [visible, survey?.id]);

  if (!survey) return null;

  const setAnswer = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  const missingRequired = survey.questions.some(
    (q) => q.required && !(answers[q.key] && answers[q.key].trim()),
  );

  const submit = () => {
    if (missingRequired || respond.isPending) return;
    const payload: Record<string, string> = {};
    for (const q of survey.questions) {
      const v = answers[q.key]?.trim();
      if (v) payload[q.key] = v;
    }
    respond.mutate(
      { id: survey.id, answers: payload },
      {
        onSuccess: () => {
          beaconedId.current = null;
          Alert.alert(t('survey.thanks'));
        },
        onError: () => Alert.alert(t('survey.failed')),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setDismissedId(survey.id)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingBottom: insets.bottom + spacing.lg, maxHeight: '88%' }}>
          {/* Header */}
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'right' }}>{survey.title}</Text>
            {!!survey.description && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.xs }}>{survey.description}</Text>
            )}
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
            {survey.questions.map((q) => (
              <View key={q.key} style={{ marginBottom: spacing.xl }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.sm }}>
                  {q.label}{q.required ? <Text style={{ color: colors.danger }}> *</Text> : null}
                </Text>

                {q.type === 'choice' ? (
                  q.options.map((opt) => {
                    const selected = answers[q.key] === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => setAnswer(q.key, opt)}
                        activeOpacity={0.8}
                        style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: selected ? colors.brand : colors.border, backgroundColor: selected ? colors.brand + '14' : colors.surface }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                          {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
                        </View>
                        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <TextInput
                    value={answers[q.key] ?? ''}
                    onChangeText={(v) => setAnswer(q.key, v)}
                    placeholder={t('survey.text_ph')}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    maxLength={2000}
                    style={{ minHeight: 80, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, color: colors.textPrimary, textAlign: 'right' }}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
            <TouchableOpacity onPress={() => setDismissedId(survey.id)} style={{ flex: 1, minHeight: 50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>{t('survey.later')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submit}
              disabled={missingRequired || respond.isPending}
              style={{ flex: 2, minHeight: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: missingRequired ? colors.borderStrong : colors.primary }}
            >
              {respond.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('survey.submit')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
