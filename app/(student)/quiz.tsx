import { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';
import { useQuizzes } from '@/hooks/useQuizzes';
import { formatShortDate } from '@/utils/format';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'quiz.upcoming_quiz', color: colors.warning, bg: colors.warningLight },
  completed: { label: 'session.completed', color: colors.success, bg: colors.successLight },
};

export default function QuizTab() {
  const { t } = useTranslation();
  const { data: quizzes, isLoading } = useQuizzes();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const enriched = useMemo(() => {
    if (!quizzes) return [];
    const now = new Date();
    return quizzes.map((q) => {
      const ended = q.ends_at ? new Date(q.ends_at) < now : false;
      const status = !q.is_active || ended ? 'completed' as const : 'pending' as const;
      return { ...q, status };
    });
  }, [quizzes]);

  const filtered = enriched.filter((q) => filter === 'all' || q.status === filter);
  const pendingCount = enriched.filter((q) => q.status === 'pending').length;
  const totalQuestions = enriched.reduce((s, q) => s + q.question_count, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#06B6D4', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('quiz.quizzes')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs }}>
            {pendingCount} {t('quiz.upcoming_quiz')} · {t('quiz.questions_count', { count: totalQuestions })}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.full, padding: 3, marginBottom: spacing.lg }}>
            {(['all', 'pending', 'completed'] as const).map((key) => (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key)}
                style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: filter === key ? colors.primary : 'transparent', alignItems: 'center' }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: filter === key ? colors.textInverse : colors.textSecondary }}>
                  {key === 'all' ? t('common.all') : key === 'pending' ? t('quiz.upcoming_quiz') : t('session.completed')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxxl }}>
              <Text style={textPresets.bodySmall}>{t('quiz.no_quizzes')}</Text>
            </View>
          ) : (
            filtered.map((quiz) => {
              const config = statusConfig[quiz.status];
              return (
                <TouchableOpacity
                  key={quiz.id}
                  activeOpacity={0.7}
                  style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.md, ...shadows.sm, borderStartWidth: 4, borderStartColor: config.color }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.subtitle}>{quiz.title}</Text>
                      <Text style={[textPresets.bodySmall, { marginTop: spacing.xs }]}>{quiz.course_name}</Text>
                    </View>
                    <View style={{ backgroundColor: config.bg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: config.color }}>{t(config.label)}</Text>
                    </View>
                  </View>

                  {quiz.status === 'pending' && quiz.ends_at && (
                    <Text style={[textPresets.bodySmall, { marginTop: spacing.sm, color: colors.textTertiary }]}>
                      {t('quiz.deadline')}: {formatShortDate(quiz.ends_at)}
                    </Text>
                  )}

                  {quiz.status === 'pending' && (
                    <TouchableOpacity activeOpacity={0.85} style={{ borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.md }}>
                      <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 12, alignItems: 'center' }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>{t('quiz.start_quiz')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}

                  <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginEnd: 4 }}>{'📝'}</Text>
                      <Text style={textPresets.caption}>{t('quiz.questions_count', { count: quiz.question_count })}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginEnd: 4 }}>{'⏱️'}</Text>
                      <Text style={textPresets.caption}>{t('quiz.duration', { minutes: quiz.duration_minutes })}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
