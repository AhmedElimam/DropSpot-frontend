import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { formatTime } from '@/utils/format';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { deleteActions, requeueAction, type OutboxAction } from '@/db/outbox';
import { queuedDetails } from '@/api/offlineQueue';
import type { OfflineMark } from '@/db/offlineMarks';
import { syncNow } from '@/db/autoSync';
import { uuid } from '@/utils/uuid';

function hhmm(iso: string): string {
  try {
    return formatTime(iso);
  } catch {
    return '—';
  }
}

/** How many lines of a parked body show before «التفاصيل» opens the rest. */
const DETAILS_PREVIEW = 2;

/**
 * One parked action: its line, when, and WHAT it carries — every plain field of the body
 * (founder 2026-10-11: «the sync tab doesn't fully show data»). Two lines at a glance, the
 * rest behind a tap.
 */
function Row({ a, children }: { a: OutboxAction; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const details = useMemo(() => queuedDetails(a.body), [a.body]);
  const [open, setOpen] = useState(false);
  const shown = open ? details : details.slice(0, DETAILS_PREVIEW);
  const hidden = details.length - DETAILS_PREVIEW;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, lineHeight: 20 }} numberOfLines={2}>{a.label}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{hhmm(a.created_at)}</Text>
      </View>
      {shown.length > 0 ? (
        <View style={{ marginTop: 4, gap: 2 }}>
          {shown.map((d, i) => (
            <Text key={`${d.label}-${i}`} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 19 }} numberOfLines={open ? undefined : 2}>
              <Text style={{ fontFamily: fonts.medium, color: colors.textSecondary }}>{d.label}: </Text>{d.value}
            </Text>
          ))}
        </View>
      ) : null}
      {hidden > 0 ? (
        <TouchableOpacity onPress={() => setOpen((o) => !o)} hitSlop={8} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 4, minHeight: 28, justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{open ? t('offline.details_less') : t('offline.details_more', { count: hidden })}</Text>
        </TouchableOpacity>
      ) : null}
      {a.last_error ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.dangerText, marginTop: 4 }}>{a.last_error}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Manual attendance marks waiting to be sent (src/db/offlineMarks.ts). They were counted
 * on the header badge but never listed here (founder 2026-10-11): the student, the mark,
 * the group, when — and the same «إرسال الآن».
 */
export function PendingMarksSection({ marks, onChange }: { marks: OfflineMark[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const statusKey: Record<string, string> = { present: 'attendance.present', late: 'attendance.late', absent: 'attendance.absent', excused: 'attendance.excused' };
  const send = async () => {
    setBusy(true);
    try { await syncNow(); await onChange(); } finally { setBusy(false); }
  };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="refresh" size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{t('offline.marks_title', { count: marks.length })}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('offline.marks_hint')}</Text>
      <View style={{ gap: spacing.sm }}>
        {marks.map((m) => (
          <View key={m.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.background }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }} numberOfLines={2}>
                {m.student_name ?? `#${m.student_id}`} · {t(statusKey[m.status] ?? 'teacher.not_recorded')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{hhmm(m.marked_at)}</Text>
            </View>
            {m.course_name ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{m.course_name}</Text> : null}
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={send} disabled={busy} activeOpacity={0.8} accessibilityRole="button"
        style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }}>
        {busy ? <ActivityIndicator color={colors.textInverse} /> : <Icon name="send" size={16} color={colors.textInverse} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textInverse }}>{t('offline.sync_now')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Actions taken with no connection, waiting to be sent in order (src/db/outbox.ts). They go
 * on their own when the connection returns; «إرسال الآن» is for the person who wants to watch.
 */
export function PendingActionsSection({ actions, onChange }: { actions: OutboxAction[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await syncNow(); await onChange(); } finally { setBusy(false); }
  };
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.primary, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="refresh" size={20} color={colors.primary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{t('offline.actions_title', { count: actions.length })}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('offline.actions_hint')}</Text>
      <View style={{ gap: spacing.sm }}>
        {actions.map((a) => <Row key={a.id} a={a} />)}
      </View>
      <TouchableOpacity onPress={send} disabled={busy} activeOpacity={0.8} accessibilityRole="button"
        style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primary, opacity: busy ? 0.7 : 1 }}>
        {busy ? <ActivityIndicator color={colors.textInverse} /> : <Icon name="send" size={16} color={colors.textInverse} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textInverse }}>{t('offline.sync_now')}</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Actions the server refused on replay: parked for a decision like rejected scans — retry or drop. */
export function RejectedActionsSection({ actions, onChange }: { actions: OutboxAction[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="error" size={20} color={colors.dangerText} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{t('offline.rejected_actions_title', { count: actions.length })}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('offline.rejected_actions_hint')}</Text>
      <View style={{ gap: spacing.sm }}>
        {actions.map((a) => (
          <Row key={a.id} a={a}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity onPress={async () => { await requeueAction(a.id, uuid()); await onChange(); }} activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary }}>
                <Icon name="refresh" size={16} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{t('teacher.rejected_requeue')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { await deleteActions([a.id]); await onChange(); }} activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border }}>
                <Icon name="trash" size={16} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('teacher.rejected_dismiss')}</Text>
              </TouchableOpacity>
            </View>
          </Row>
        ))}
      </View>
    </View>
  );
}
