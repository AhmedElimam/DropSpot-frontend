import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { FormScreen } from '@/components/ui/Form';
import { RoseStamp, useStampBurst } from '@/components/rose/RoseStamp';
import { useRose } from '@/hooks/useRose';
import { useAuthStore } from '@/stores/authStore';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatNumber, formatTime } from '@/utils/format';
import { openRemotePdf } from '@/utils/openPdf';
import { getRoseReset, getRoseArchiveUrl, resetRoseBook } from '@/api/cash';
import { Surface } from '@/ui/surfaces';

/** Her blue-violet ink — the colour of a book she closed (founder 2026-10-19). */
const VIOLET = '#4B3BB0';
const money = (n: number) => `${formatNumber(Math.round(n))} ج.م`;

/**
 * «منطقة الخطر — تصفير دفتر مدام روز» (founder 2026-10-19: «a danger zone button zeroing
 * everything on insights, expenses and cash keeping — it won't work unless the teacher downloads
 * a PDF of that data first, with a new blue-purple stamp; only the teacher; pending and previous
 * collections stay the same»).
 *
 * Two steps on one screen, the second locked until the first is done:
 *   ١ download her whole book as a PDF (the server issues it under the violet stamp, with a code);
 *   ٢ type the word and press — the server checks again that a fresh, matching copy exists.
 * Nothing is deleted on the server: the old book is archived; collections and dues never move.
 */
export default function RoseResetScreen() {
  const { t } = useTranslation();
  const rose = useRose();
  const qc = useQueryClient();
  const isTeacher = useAuthStore((s) => s.role) === 'teacher';
  const impersonating = !!useAuthStore((s) => s.impersonation?.active);
  const { burst, burstNode } = useStampBurst();
  const [typed, setTyped] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const q = useQuery({ queryKey: ['rose-reset'], queryFn: getRoseReset, enabled: isTeacher && !impersonating });
  const p = q.data;
  const ready = !!p?.archive;
  const wordOk = !!p && typed.replace(/\s+/g, '') === p.confirm_word;

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const url = await getRoseArchiveUrl();
      await openRemotePdf(url, t('rose_reset.file_name'));
      const fresh = await q.refetch();
      if (fresh.data?.archive) burst('violet', t('rose_reset.archived_burst', { code: fresh.data.archive.code }));
    } catch {
      Alert.alert(t('common.error'), t('cash.export_failed'));
    } finally {
      setDownloading(false);
    }
  };

  const run = () => {
    if (!p || !wordOk || !ready) return;
    Alert.alert(t('rose_reset.confirm_title'), t('rose_reset.confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('rose_reset.confirm_go'), style: 'destructive', onPress: async () => {
          setResetting(true);
          try {
            await resetRoseBook(typed);
            for (const key of ['cash-reconciliation', 'cash-month', 'cash-insights', 'expenses', 'teacher-insights', 'rose-sheet', 'cash-collections', 'rose-reset']) {
              qc.invalidateQueries({ queryKey: [key] });
            }
            setTyped('');
            if (!burst('violet', t('rose_reset.done_burst'))) Alert.alert(t('rose_reset.done_title'), t('rose_reset.done_burst'));
            setTimeout(() => router.back(), 1600);
          } catch (e) {
            // 409: no copy / too old / the book changed since the copy — the server's sentence says which.
            Alert.alert(t('rose_reset.refused_title'), getFriendlyErrorMessage(e));
            q.refetch();
          } finally {
            setResetting(false);
          }
        },
      },
    ]);
  };

  if (!isTeacher || impersonating) {
    return (
      <Surface id="screen.teacher.rose_reset" screen>
        <FormScreen title={t('rose_reset.title')}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>{t('rose_reset.teacher_only')}</Text>
        </FormScreen>
      </Surface>
    );
  }

  const line = (icon: IconName, tint: string, label: string, value?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 7 }}>
      <Icon name={icon} size={17} color={tint} />
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }}>{label}</Text>
      {value ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{value}</Text> : null}
    </View>
  );
  const stepBadge = (n: string, done: boolean, locked: boolean) => (
    <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.success : locked ? colors.border : VIOLET }}>
      {done ? <Icon name="success" size={18} color="#FFFFFF" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#FFFFFF' }}>{n}</Text>}
    </View>
  );
  const card = { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md } as const;

  return (
    <Surface id="screen.teacher.rose_reset" screen>
      <View style={{ flex: 1 }}>
        <FormScreen title={t('rose_reset.title')} subtitle={t('rose_reset.subtitle', { rose: rose.name })} loading={q.isLoading}>
          {q.isError ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.dangerText, textAlign: 'center', marginTop: spacing.lg }}>{getFriendlyErrorMessage(q.error)}</Text>
          ) : p ? (
            <View>
              {/* The warning, said once and plainly. */}
              <Surface id="teacher.rose_reset.warning">
                <View style={[card, { borderColor: colors.danger, backgroundColor: colors.dangerLight, flexDirection: 'row', gap: spacing.md, alignItems: 'center' }]}>
                  <Icon name="warning" size={26} color={colors.danger} />
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.dangerText }}>{t('rose_reset.warning')}</Text>
                </View>
              </Surface>

              <Surface id="teacher.rose_reset.clears">
                <View style={card}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginBottom: 4 }}>{t('rose_reset.clears_title')}</Text>
                  {line('money', colors.danger, t('rose_reset.clears_expenses', { count: p.clears.expenses.count }), money(p.clears.expenses.total))}
                  {line('lock', colors.danger, t('rose_reset.clears_drawers', { count: p.clears.drawers.count }))}
                  {line('transfer', colors.danger, t('rose_reset.clears_handovers', { count: p.clears.handovers.count }), money(p.clears.handovers.total))}
                  {p.clears.corrections.count > 0 ? line('note', colors.danger, t('rose_reset.clears_corrections', { count: p.clears.corrections.count })) : null}
                  {line('trophy', colors.danger, t('rose_reset.clears_insights'))}
                </View>
              </Surface>

              <Surface id="teacher.rose_reset.keeps">
                <View style={[card, { borderColor: colors.success }]}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.successText, marginBottom: 4 }}>{t('rose_reset.keeps_title')}</Text>
                  {line('success', colors.success, t('rose_reset.keeps_collected'), money(p.keeps.collected_total))}
                  {line('success', colors.success, t('rose_reset.keeps_pending'), money(p.keeps.pending_total))}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('rose_reset.keeps_hint')}</Text>
                </View>
              </Surface>

              {/* ١ — the copy. */}
              <Surface id="teacher.rose_reset.step_pdf">
                <View style={[card, { borderColor: ready ? colors.success : VIOLET, borderWidth: 1.5 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                    {stepBadge('١', ready, false)}
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('rose_reset.step1_title')}</Text>
                    {ready ? <RoseStamp ink="violet" size={46} /> : null}
                  </View>
                  {ready && p.archive ? (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary, marginBottom: spacing.sm }}>
                      {t('rose_reset.step1_done', { code: p.archive.code, time: formatTime(p.archive.expires_at) })}
                    </Text>
                  ) : (
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 21, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('rose_reset.step1_hint', { minutes: p.archive_valid_minutes })}</Text>
                  )}
                  <TouchableOpacity onPress={download} disabled={downloading} activeOpacity={0.85} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.lg, backgroundColor: ready ? colors.surface : VIOLET, borderWidth: 1.5, borderColor: VIOLET }}>
                    {downloading ? <ActivityIndicator color={ready ? VIOLET : '#FFFFFF'} /> : <Icon name="download" size={18} color={ready ? VIOLET : '#FFFFFF'} />}
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: ready ? VIOLET : '#FFFFFF' }}>{ready ? t('rose_reset.step1_again') : t('rose_reset.step1_button')}</Text>
                  </TouchableOpacity>
                </View>
              </Surface>

              {/* ٢ — the word, then the button. Locked until ١ is done. */}
              <Surface id="teacher.rose_reset.step_confirm">
                <View style={[card, { opacity: ready ? 1 : 0.55, borderColor: ready ? colors.danger : colors.border, borderWidth: 1.5 }]} pointerEvents={ready ? 'auto' : 'none'}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                    {stepBadge('٢', false, !ready)}
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('rose_reset.step2_title')}</Text>
                    {!ready ? <Icon name="lock" size={18} color={colors.textTertiary} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('rose_reset.step2_hint', { word: p.confirm_word })}</Text>
                  <TextInput value={typed} onChangeText={setTyped} editable={ready} placeholder={p.confirm_word} placeholderTextColor={colors.textTertiary}
                    autoCorrect={false} autoCapitalize="none" accessibilityLabel={t('rose_reset.step2_hint', { word: p.confirm_word })}
                    style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, borderWidth: 1, borderColor: wordOk ? colors.danger : colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'center', marginBottom: spacing.md, backgroundColor: colors.surfaceSunken }} />
                  <Button title={t('rose_reset.step2_button')} variant="destructive" onPress={run} disabled={!ready || !wordOk} loading={resetting} />
                </View>
              </Surface>
            </View>
          ) : null}
        </FormScreen>
        {burstNode}
      </View>
    </Surface>
  );
}
