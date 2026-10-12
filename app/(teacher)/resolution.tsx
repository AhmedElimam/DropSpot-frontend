import { SheetModal } from '@/components/ui/SheetModal';
import { useState } from 'react';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { Alert } from '@/ui/dialog';
import { ScrollView } from '@/components/ui/Refreshable';
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
  getStudentEditRequests, approveStudentEditRequest, rejectStudentEditRequest,
  type ExcuseItem, type SwapItem, type TerminationCandidate, type StudentEditReq,
  getAssistantReports, approveAssistantReport, rejectAssistantReport, type AssistantReportItem,
} from '@/api/resolution';
import { createAdminTicket, getMyAdminTickets, getSupportCategories, type AdminTicket } from '@/api/adminTickets';
import { SelectField } from '@/components/ui/SelectField';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { Surface } from '@/ui/surfaces';
import { formatShortDate } from '@/utils/format';

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
  // A reason routes the ticket in the /ops queue — same dropdown the family side uses,
  // fed by the server so staff and families never see each other's wording.
  const [category, setCategory] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Only what this person can act on (founder 2026-09-26): family corrections need
  // manage_students; the assistants' own reports wait for the teacher alone.
  const { can, isAssistant } = useActiveAbilities();
  const canManage = can(ABILITY.MANAGE_STUDENTS);
  const summary = useQuery({ queryKey: ['resolution-summary'], queryFn: getResolutionSummary });
  const excuses = useQuery({ queryKey: ['resolution-excuses'], queryFn: getPendingExcuses });
  const swaps = useQuery({ queryKey: ['resolution-swaps'], queryFn: getPendingSwaps });
  const candidates = useQuery({ queryKey: ['resolution-termination'], queryFn: getTerminationCandidates });
  const editRequests = useQuery({ queryKey: ['resolution-edit-requests'], queryFn: getStudentEditRequests, enabled: canManage });
  // What the assistants filed — waits for the teacher before the admins see it.
  const assistantReports = useQuery({ queryKey: ['resolution-assistant-reports'], queryFn: getAssistantReports, enabled: !isAssistant });
  const myTickets = useQuery({ queryKey: ['my-admin-tickets'], queryFn: getMyAdminTickets });
  const ticketCategories = useQuery({ queryKey: ['support-categories'], queryFn: getSupportCategories });

  const sendTicket = async () => {
    if (!category) {
      Alert.alert('', t('resolution.ticket_reason_required'));
      return;
    }
    if (subject.trim().length < 3 || message.trim().length < 20) {
      Alert.alert('', t('resolution.ticket_too_short'));
      return;
    }
    setSending(true);
    try {
      await createAdminTicket({ category, subject: subject.trim(), message: message.trim() });
      setSubject(''); setMessage(''); setCategory(null); setComposeOpen(false);
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
    qc.invalidateQueries({ queryKey: ['resolution-edit-requests'] });
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
  const { refreshing, onRefresh } = usePullRefresh(
    summary.refetch, excuses.refetch, swaps.refetch, candidates.refetch, myTickets.refetch, editRequests.refetch,
  );
  const s = summary.data;

  return (
    <Surface id="screen.teacher.resolution" screen>
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <Surface id="teacher.resolution.header">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('teacher.resolution_title')}</Text>
      </View>
      </Surface>

      <Surface id="teacher.resolution.tip">
      <TeacherTip
        tip="reports"
        icon="reports"
        titleKey="onboarding.tip_reports_title"
        bodyKey="onboarding.tip_reports_body"
        bulletKeys={['onboarding.tip_reports_b1']}
      />
      </Surface>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.lg, paddingBottom: nav.pageEnd + insets.bottom + spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Summary tiles — 2×2 grid so the Arabic labels never crowd/overflow. */}
          <Surface id="teacher.resolution.summary">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
            <Surface id="teacher.resolution.summary.excuses"><SummaryTile label={t('resolution.excuses')} value={s?.excuses ?? 0} /></Surface>
            <Surface id="teacher.resolution.summary.swaps"><SummaryTile label={t('resolution.swaps')} value={s?.swaps ?? 0} /></Surface>
            <Surface id="teacher.resolution.summary.tickets"><SummaryTile label={t('resolution.tickets')} value={s?.tickets ?? 0} /></Surface>
            <Surface id="teacher.resolution.summary.candidates"><SummaryTile label={t('resolution.candidates')} value={s?.termination_candidates ?? 0} /></Surface>
          </View>
          </Surface>

          {/* «أرقام تحتاج تأكيد» (§5) — the queue's permanent home. The home screen only
              surfaces it while it is non-empty; here it stays put so a teacher who wants
              to go looking always knows where it lives. */}
          <Surface id="teacher.resolution.phone_confirmations_link">
          {(s?.phone_confirmations ?? 0) > 0 ? (
            <TouchableOpacity onPress={() => router.push('/(teacher)/phone-confirmations' as Href)} activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.warning + '55', padding: spacing.lg, marginTop: spacing.md }}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.warningLight, justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="phone" size={22} color={colors.warningText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('home.phones_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {t('desk_ui.phones_unconfirmed_count', { count: s?.phone_confirmations })}
                </Text>
              </View>
              <Icon name="back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
          </Surface>

          {/* Contact the admin — a general teacher→super-admin message channel. */}
          <Surface id="teacher.resolution.contact_admin">
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
          </Surface>

          {/* My messages to admin — status tracking. */}
          <Surface id="teacher.resolution.my_admin_tickets">
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
          </Surface>

          {/* Auto-termination candidates — 3 consecutive unexcused absences. Confirm only. */}
          <Surface id="teacher.resolution.termination">
          {candidates.data && candidates.data.length > 0 ? (
            <>
              <SectionTitle>{t('resolution.termination')}</SectionTitle>
              {candidates.data.map((c: TerminationCandidate) => (
                <View key={`term-${c.id}`} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger + '55', padding: spacing.lg, marginBottom: spacing.sm }}>
                  {/* Who, and a tap opens them — the decision is made looking at the student. */}
                  <TouchableOpacity onPress={() => router.push(`/(teacher)/students/${c.student_id}` as Href)} activeOpacity={0.8} accessibilityRole="button"
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Icon name="warning" size={18} color={colors.danger} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{c.student_name ?? '—'}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 1 }} numberOfLines={1}>
                        {[c.student_code, c.course_name].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={{ minWidth: 34, height: 34, borderRadius: 17, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.dangerText }}>{c.absences}</Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm }}>{t('resolution.absences_n', { n: c.absences })}</Text>
                  {/* The run itself: which sessions, oldest to newest, and when they last came. */}
                  {c.absent_dates && c.absent_dates.length ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
                      {[...c.absent_dates].reverse().map((d, i) => (
                        <View key={`${d}-${i}`} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
                          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>{formatShortDate(d)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: spacing.sm }}>
                    {c.last_present_at ? t('resolution.last_present', { date: formatShortDate(c.last_present_at) }) : t('resolution.never_present')}
                  </Text>
                  <Surface id="teacher.resolution.termination.terminate_button">
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
                  </Surface>
                </View>
              ))}
            </>
          ) : null}
          </Surface>

          <Surface id="teacher.resolution.all_clear">
          {(s?.total ?? 0) === 0 ? (
            <View style={{ alignItems: 'center', marginTop: spacing.xxl }}>
              <Icon name="bell" size={40} color={colors.textTertiary} />
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: spacing.md }}>{t('resolution.all_clear')}</Text>
            </View>
          ) : null}
          </Surface>

          {/* Excuses */}
          <Surface id="teacher.resolution.excuses">
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
          </Surface>

          {/* Swaps */}
          <Surface id="teacher.resolution.swaps">
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
          </Surface>

          {/* Assistant-filed incident reports / parent-number flags — the teacher forwards
              (approve → the admin queue, as the teacher's own) or closes them. */}
          <Surface id="teacher.resolution.assistant_reports">
          {assistantReports.data && assistantReports.data.length > 0 ? (
            <>
              <SectionTitle>{t('desk_ui.assistant_reports_title')}</SectionTitle>
              {assistantReports.data.map((r: AssistantReportItem) => (
                <ReviewCard
                  key={`ar-${r.kind}-${r.id}`}
                  title={`${r.student_name ?? '—'} · ${r.kind === 'report' ? (r.severity === 'safety_critical' ? t('desk_ui.report_safety_critical') : t('desk_ui.report_incident')) : t('desk_ui.parent_number_wrong')}`}
                  subtitle={[
                    r.assistant_name ? t('desk_ui.from_person', { name: r.assistant_name }) : null,
                    r.kind === 'report' ? (r.description ?? '') : [r.parent_name, r.old_number, r.reason].filter(Boolean).join(' · '),
                  ].filter(Boolean).join(' — ')}
                  busy={busy === `ar-${r.kind}-${r.id}`}
                  onApprove={() => act(`ar-${r.kind}-${r.id}`, async () => { await approveAssistantReport(r.kind, r.id); await assistantReports.refetch(); })}
                  onReject={() => act(`ar-${r.kind}-${r.id}`, async () => { await rejectAssistantReport(r.kind, r.id); await assistantReports.refetch(); })}
                  t={t}
                />
              ))}
            </>
          ) : null}
          </Surface>

          {/* Family name-correction requests (Tier B) — approve applies immediately */}
          <Surface id="teacher.resolution.edit_requests" assistantNeeds="manage_students">
          {editRequests.data && editRequests.data.length > 0 ? (
            <>
              <SectionTitle>{t('desk_ui.edit_requests_title')}</SectionTitle>
              {editRequests.data.map((r: StudentEditReq) => (
                <ReviewCard
                  key={`edit-${r.id}`}
                  title={r.student_name}
                  subtitle={[`${r.current_name} ← ${r.proposed_name}`, r.reason].filter(Boolean).join(' · ')}
                  busy={busy === `edit-${r.id}`}
                  onApprove={() => act(`edit-${r.id}`, () => approveStudentEditRequest(r.id))}
                  onReject={() => act(`edit-${r.id}`, () => rejectStudentEditRequest(r.id))}
                  t={t}
                />
              ))}
            </>
          ) : null}
          </Surface>

          {/* Tickets — link out to the existing tickets surface */}
          <Surface id="teacher.resolution.tickets_link">
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
          </Surface>
        </ScrollView>
      )}

      {/* Compose a message to the super-admin. */}
      <Surface id="teacher.resolution.compose_sheet">
      <SheetModal visible={composeOpen} onClose={() => setComposeOpen(false)} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md }}>{t('resolution.contact_admin')}</Text>

            <View style={{ marginBottom: spacing.md }}>
              <SelectField
                label={t('resolution.ticket_reason')}
                placeholder={ticketCategories.isLoading ? '…' : t('resolution.ticket_reason_ph')}
                value={category}
                options={ticketCategories.data ?? []}
                onChange={setCategory}
                emptyHint={t('desk_ui.reasons_load_failed')}
              />
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xs }}>{t('resolution.ticket_subject')}</Text>
            <TextInput value={subject} onChangeText={setSubject} placeholder={t('resolution.ticket_subject_ph')} placeholderTextColor={colors.textTertiary}
              style={{ backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 46, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md }} />

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.xs }}>{t('resolution.ticket_message')}</Text>
            <TextInput value={message} onChangeText={setMessage} placeholder={t('resolution.ticket_message_ph')} placeholderTextColor={colors.textTertiary} multiline
              style={{ backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 100, fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right', textAlignVertical: 'top', marginBottom: spacing.lg }} />

            <Surface id="teacher.resolution.compose_sheet.send">
            <TouchableOpacity onPress={sendTicket} disabled={sending} activeOpacity={0.85}
              style={{ minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm }}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('resolution.send')}</Text>}
            </TouchableOpacity>
            </Surface>
            <TouchableOpacity onPress={() => setComposeOpen(false)} style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
      </SheetModal>
      </Surface>
    </View>
    </Surface>
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
        <Surface id="teacher.resolution.review.reject_button">
        <TouchableOpacity onPress={onReject} disabled={busy} activeOpacity={0.85}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('resolution.reject')}</Text>
        </TouchableOpacity>
        </Surface>
        <Surface id="teacher.resolution.review.approve_button">
        <TouchableOpacity onPress={onApprove} disabled={busy} activeOpacity={0.85}
          style={{ flex: 2, backgroundColor: colors.success, borderRadius: radius.md, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('resolution.approve')}</Text>}
        </TouchableOpacity>
        </Surface>
      </View>
    </View>
  );
}
