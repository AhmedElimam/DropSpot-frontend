import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients } from '@/theme/index';
import { getQuizWithQuestions, startAttempt, submitAttempt } from '@/api/quizzes';
import type { Question } from '@/types/quiz';
import { Icon } from '@/components/ui/Icon';

interface QuizRunnerProps {
  quizId: number;
  studentId: number;
}

export function QuizRunner({ quizId, studentId }: QuizRunnerProps) {
  const { t } = useTranslation();
  // Block screenshots / screen recording while the quiz is on screen — stops
  // questions and answers from being captured and shared. Scoped to this
  // component only (active while mounted, released on unmount).
  usePreventScreenCapture();

  const [quiz, setQuiz] = useState<{ title: string; max_score: number; course_name?: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; max_score: number; passed: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!quizId || !studentId) return;

    (async () => {
      try {
        const { quiz: q, questions: qs } = await getQuizWithQuestions(quizId);
        const attempt = await startAttempt(quizId, studentId);

        setQuiz(q);
        setQuestions(qs);
        setAttemptId(attempt.id);
        setTimeLeft(q.duration_minutes * 60);
        setLoading(false);
      } catch {
        Alert.alert(t('common.error'), t('quiz.load_error'));
        router.back();
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [quizId, studentId]);

  useEffect(() => {
    if (loading || timeLeft <= 0 || result) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, result]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const selectAnswer = useCallback((value: string | string[]) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    if (currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 200);
    }
  }, [currentQuestion, currentIndex, questions.length]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const formattedAnswers: Record<string, string | string[]> = {};
    for (const [qId, val] of Object.entries(answers)) {
      formattedAnswers[qId] = val;
    }

    try {
      const attemptResult = await submitAttempt(attemptId, formattedAnswers);
      setResult({
        score: attemptResult.score ?? 0,
        max_score: attemptResult.max_score ?? quiz?.max_score ?? 0,
        passed: attemptResult.passed ?? false,
      });
    } catch {
      Alert.alert(t('common.error'), t('quiz.submit_error'));
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, submitting, answers, quiz, t]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (result) {
    const pct = result.max_score > 0 ? Math.round((result.score / result.max_score) * 100) : 0;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={result.passed ? gradients.success : [colors.dangerDark, colors.danger]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl }}
        >
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
            <Icon name={result.passed ? 'trophy' : 'info'} size={52} color="#fff" />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 48, color: '#fff', letterSpacing: -1 }}>
            {pct}%
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 18, color: 'rgba(255,255,255,0.8)', marginTop: spacing.sm }}>
            {result.score} / {result.max_score}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: spacing.lg }}>
            {result.passed ? t('quiz.passed') : t('quiz.failed')}
          </Text>

          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{ marginTop: spacing.xl4, backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: spacing.md, paddingHorizontal: spacing.xl4, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('common.done')}</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isTrueFalse = currentQuestion.type === 'true_false';
  const isMultipleChoice = currentQuestion.type === 'multiple_choice';
  const choices = currentQuestion.options ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: spacing.xs }}>
            <Icon name="forward" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff', flex: 1, textAlign: 'center', marginHorizontal: spacing.md }} numberOfLines={1}>
            {quiz?.title ?? ''}
          </Text>
          <View style={{ backgroundColor: timeLeft < 60 ? colors.danger : 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: radius.full }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff', direction: 'ltr' }}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        </View>

        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: spacing.md, overflow: 'hidden' }}>
          <View style={{ width: `${progress}%`, height: '100%', backgroundColor: '#fff', borderRadius: 2 }} />
        </View>

        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: spacing.sm }}>
          {currentIndex + 1} / {questions.length} · {answeredCount}/{questions.length} {t('quiz.answered')}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
        <Text style={textPresets.h2}>{currentQuestion.text}</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.xxl }}>
          {isTrueFalse && (
            <>
              {['true', 'false'].map((val) => {
                const selected = answers[currentQuestion.id] === val;
                return (
                  <TouchableOpacity
                    key={val}
                    onPress={() => selectAnswer(val)}
                    activeOpacity={0.7}
                    style={{
                      padding: spacing.lg, borderRadius: radius.md, borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryLight : colors.surface,
                      ...shadows.sm,
                    }}
                  >
                    <Text style={{ fontFamily: selected ? fonts.bold : fonts.regular, fontSize: 16, color: selected ? colors.primary : colors.textPrimary, textAlign: 'center' }}>
                      {val === 'true' ? t('quiz.true') : t('quiz.false')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {isMultipleChoice && choices.map((choice, idx) => {
            const selected = answers[currentQuestion.id] === choice;
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => selectAnswer(choice)}
                activeOpacity={0.7}
                style={{
                  padding: spacing.lg, borderRadius: radius.md, borderWidth: 2,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
                  ...shadows.sm,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.primary : 'transparent',
                    justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md,
                  }}>
                    {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, flex: 1 }}>
                    {choice}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {currentIndex > 0 && (
            <TouchableOpacity
              onPress={() => setCurrentIndex((i) => i - 1)}
              activeOpacity={0.7}
              style={{ flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.borderLight, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary }}>{t('quiz.previous')}</Text>
            </TouchableOpacity>
          )}

          {currentIndex < questions.length - 1 ? (
            <TouchableOpacity
              onPress={() => setCurrentIndex((i) => i + 1)}
              activeOpacity={0.8}
              style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden' }}
            >
              <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, justifyContent: 'center', paddingVertical: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('common.next')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
              style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden', opacity: submitting ? 0.6 : 1 }}
            >
              <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ minHeight: 52, justifyContent: 'center', paddingVertical: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
                  {submitting ? t('common.loading') : t('quiz.submit')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
