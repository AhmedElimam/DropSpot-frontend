import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { TeacherTip } from '@/components/TeacherTip';
import {
  getResolutionSummary, getPendingExcuses, getPendingSwaps,
  approveExcuse, rejectExcuse, approveSwap, rejectSwap,
  getTerminationCandidates, terminateEnrollment,
  type ExcuseItem, type SwapItem, type TerminationCandidate,
} from '@/api/resolution';
import { createAdminTicket, getMyAdminTickets, type AdminTicket } from '@/api/adminTickets';

/**
 * Resolution Center — the teacher's consolidated review hub. Aggregates the review
 * queues that were previously web-only (absence excuses, session-swap requests) with
 * inline approve/reject, plus a link into tickets. Mirrors the web needs-attention pattern.
 */
export default function ResolutionCenter() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  // Admin-ticket compose ("مراسلة الإدارة") — a general teacher→super-admin channel.
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const summary = useQuery({ queryKey: ['resolution-summary'], queryFn: getResolutionSummary });
  const excuses = useQuery({ queryKey: ['resolution-excuses'], queryFn: getPendingExcuses });
  const swaps = useQuery({ queryKey: ['resolution-swaps'], queryFn: getPendingSwaps });
  const candidates = useQuery({ queryKey: ['resolution-termination'], queryFn: getTerminationCandidates });
  const myTickets = useQuery({ queryKey: ['my-admin-tickets'], queryFn: getMyAdminTickets });

  const sendTicket = async () => {
    if (subject.trim().length < 3 || message.trim().length < 20) {
      Alert.alert('', t('resolution.ticket_too_short'));
      return;
    }
    setSending(true);
    try {
      await createAdminTicket({ subject: subject.trim(), message: message.trim() });
      setSubject(''); setMessage(''); setComposeOpen(false);
      qc.invalidateQueries({ queryKey: ['my-admin-tickets'] });
      Alert.alert('', t('resolution.ticket_sent'));
    } catch {
      Alert.alert(t('common.error'), t('resolution.ticket_failed'));
    } finally {
      setSending(false);
    }
  };

  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['resolution-summary'] });
    qc.invalidateQueries({ queryKey: ['resolution-excuses'] });
    qc.invalidateQueries({ queryKey: ['resolution-swaps'] });
    qc.invalidateQueries({ queryKey: ['resolution-termination'] });
  };

  const confirmTerminate = (c: TerminationCandidate) => {
    Alert.alert(
      t('resolution.terminate_title'),
      t('resolution.terminate_confirm', { name: c.student_name ?? '', course: c.course_name ?? '', n: c.absences }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('resolution.terminate_action'), style: 'destructive', onPress: () => act(`term-${c.id}`, () => terminateEnrollment(c.enrollment_id)) },
      ],
    );
  };

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      refetchAll();
    } catch {
      Alert.alert(t('common.error'), t('resolution.action_failed'));
    } finally {
      setBusy(null);
    }
  };

  const loading = summary.isLoading || excuses.isLoading || swaps.isLoading || candidates.isLoading;
  const refreshing = summary.isRefetching || excuses.isRefetching || swaps.isRefetching || candidates.isRefetching;
  const s = summary.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.resolution_title')}</Text>
      </View>

      <TeacherTip
        tip="reports"
        icon="reports"
        titleKey="onboarding.tip_reports_title"
        bodyKey="onboarding.tip_reports_body"
        bulletKeys={['onboarding.tip_reports_b1']}
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={colors.primary} />}
        >
          {/* Summary tiles — 2×2 grid so the Arabic labels never crowd/overflow. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            <SummaryTile label={t('resolution.excuses')} value={s?.excuses ?? 0} />
            <SummaryTile label={t('resolution.swaps')} value={s?.swaps ?? 0} />
            <SummaryTile label={t('resolution.tickets')} value={s?.tickets ?? 0} />
            <SummaryTile label={t('resolution.candidates')} value={s?.termination_candidates ?? 0} />
          </View>

          {/* Contact the admin — a general teacher→super-admin message channel. */}
          <TouchableOpacity onPress={() => setComposeOpen(true)} activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: spacing.md }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brand + '18', justifyContent: 'center', alignItems: 'center' }}>
              <Icon name="tickets" size={22} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('resolution.contact_admin')}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('resolution.contact_admin_sub')}</Text>
            </View>
            <Icon name="add" size={20} color={colors.brand} />
          </TouchableOpacity>

          {/* My messages to admin — status tracking. */}
          {myTickets.data && myTickets.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.my_admin_tickets')}</SectionTitle>
              {myTickets.data.map((tk: AdminTicket) => (
                <View key={`at-${tk.id}`} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>{tk.subject}</Text>
                    <View style={{ backgroundColor: (tk.status === 'resolved' ? colors.success : colors.warning) + '22', borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 10 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: tk.status === 'resolved' ? colors.success : colors.warning }}>
                        {t(tk.status === 'resolved' ? 'resolution.status_resolved' : 'resolution.status_open')}
                      </Text>
                    </View>
                  </View>
                  {tk.admin_note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{tk.admin_note}</Text> : null}
                </View>
              ))}
            </>
          ) : null}

          {/* Auto-termination candidates — 3 consecutive unexcused absences. Confirm only. */}
          {candidates.data && candidates.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.termination')}</SectionTitle>
              {candidates.data.map((c: TerminationCandidate) => (
                <View key={`term-${c.id}`} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger + '55', padding: spacing.lg, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Icon name="warning" size={18} color={colors.danger} />
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{c.student_name ?? '—'}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
                    {[c.course_name, t('resolution.absences_n', { n: c.absences })].filter(Boolean).join(' · ')}
                  </Text>
                  <TouchableOpacity
                    disabled={busy === `term-${c.id}`}
                    onPress={() => confirmTerminate(c)}
                    activeOpacity={0.85}
                    style={{ marginTop: spacing.md, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}
                  >
                    {busy === `term-${c.id}` ? (
                      <ActivityIndicator color={colors.dangerText} />
                    ) : (
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.dangerText }}>{t('resolution.terminate_action')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : null}

          {(s?.total ?? 0) === 0 ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <Icon name="bell" size={40} color={colors.textTertiary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>{t('resolution.all_clear')}</Text>
            </View>
          ) : null}

          {/* Excuses */}
          {excuses.data && excuses.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.excuses')}</SectionTitle>
              {excuses.data.map((e: ExcuseItem) => (
                <ReviewCard
                  key={`ex-${e.id}`}
                  title={e.student_name}
                  subtitle={[e.course_name, e.reason].filter(Boolean).join(' · ')}
                  busy={busy === `ex-${e.id}`}
                  onApprove={() => act(`ex-${e.id}`, () => approveExcuse(e.id))}
                  onReject={() => act(`ex-${e.id}`, () => rejectExcuse(e.id))}
                  t={t}
                />
              ))}
            </>
          ) : null}

          {/* Swaps */}
          {swaps.data && swaps.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.swaps')}</SectionTitle>
              {swaps.data.map((sw: SwapItem) => (
                <ReviewCard
                  key={`sw-${sw.id}`}
                  title={sw.student_name}
                  subtitle={[sw.to_course, sw.remaining != null ? t('resolution.remaining', { n: sw.remaining }) : null].filter(Boolean).join(' · ')}
                  busy={busy === `sw-${sw.id}`}
                  onApprove={() => act(`sw-${sw.id}`, () => approveSwap(sw.id))}
                  onReject={() => act(`sw-${sw.id}`, () => rejectSwap(sw.id))}
                  t={t}
                />
              ))}
            </>
          ) : null}

          {/* Tickets — link out to the existing tickets surface */}
          {(s?.tickets ?? 0) > 0 ? (
            <>
              <SectionTitle>{t('resolution.tickets')}</SectionTitle>
              <TouchableOpacity onPress={() => router.push('/(teacher)/tickets' as Href)} activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.brand + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="tickets" size={22} color={colors.brand} />
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('resolution.open_tickets', { n: s?.tickets ?? 0 })}</Text>
                <Icon name="back" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      )}

      {/* Compose a message to the super-admin. */}
      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md }}>{t('resolution.contact_admin')}</Text>

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xs }}>{t('resolution.ticket_subject')}</Text>
            <TextInput value={subject} onChangeText={setSubject} placeholder={t('resolution.ticket_subject_ph')} placeholderTextColor={colors.textTertiary}
              style={{ backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 46, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }} />

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xs }}>{t('resolution.ticket_message')}</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder={t('resolution.ticket_message_ph')} placeholderTextColor={colors.textTertiary} multiline
              style={{ backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 100, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top', marginBottom: spacing.lg }} />

            <TouchableOpacity onPress={sendTicket} disabled={sending} activeOpacity={0.85}
              style={{ minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm }}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('resolution.send')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setComposeOpen(false)} style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  // width:'48%' + parent flexWrap → a 2×2 grid, so long Arabic labels never crowd.
  return (
    <View style={{ width: '48%', flexGrow: 1, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: value > 0 ? colors.brand : colors.textTertiary }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginTop: spacing.xl, marginBottom: spacing.sm }}>{children}</Text>;
}

function ReviewCard({ title, subtitle, busy, onApprove, onReject, t }: {
  title: string; subtitle: string; busy: boolean; onApprove: () => void; onReject: () => void; t: (k: string) => string;
}) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
      {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text> : null}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity onPress={onReject} disabled={busy} activeOpacity={0.85}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('resolution.reject')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onApprove} disabled={busy} activeOpacity={0.85}
          style={{ flex: 2, backgroundColor: colors.success, borderRadius: radius.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('resolution.approve')}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}
