import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { formatTime } from '@/utils/format';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { syncOfflineBatch } from '@/api/teacher';
import { getPendingScans, getRejectedScans, deleteScan, requeueScan, type OfflineScan } from '@/db/offlineScans';
import { computeBuckets, type ScanBucket } from '@/db/buckets';
import { suggestSessionId, applyBatchResults } from '@/db/reconcile';
import { getFreshScheduleEntries, getFreshScheduleEntry, buildGradeResolver } from '@/db/scheduleCache';
import { useAuthStore, stampTeacherId } from '@/stores/authStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';

const DAY_MS = 24 * 60 * 60 * 1000;

function hhmm(iso: string): string {
  try {
    return formatTime(iso);
  } catch {
    return '—';
  }
}

export default function Reconcile() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: sessions, refetch: refetchSessions } = useTeacherTodaySessions();
  const [buckets, setBuckets] = useState<ScanBucket[] | null>(null);
  const [rejected, setRejected] = useState<OfflineScan[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [oldestPending, setOldestPending] = useState<string | null>(null);
  // Today's cached schedule (Part 2): offline fallback for session hints, and the
  // grade source for Part 1's grade-aware bucket split. Null if stale/absent.
  const [cachedSessions, setCachedSessions] = useState<TeacherSession[]>([]);

  const load = useCallback(async () => {
    // Grade resolver spans ALL of today's cached teacher entries; each scan resolves
    // against the entry for ITS OWN stamped teacher_id (not the active one), so an
    // assistant's teacher-A scans never grade-check against teacher B's roster.
    const activeTeacherId = stampTeacherId(useAuthStore.getState());
    const [pending, rej, entries, activeEntry] = await Promise.all([
      getPendingScans(),
      getRejectedScans(),
      getFreshScheduleEntries(),
      getFreshScheduleEntry(activeTeacherId),
    ]);
    // Grade-aware bucketing (Part 1): a known grade change splits the bucket, same
    // as a teacher change. Falls back to time/teacher-only when no fresh cache.
    setBuckets(computeBuckets(pending, buildGradeResolver(entries)));
    // Offline session hints use the ACTIVE teacher's cached sessions.
    setCachedSessions(activeEntry?.sessions ?? []);
    setRejected(rej);
    setPendingCount(pending.length);
    setOldestPending(pending[0]?.scanned_at ?? null); // getPendingScans is chronological
    await useOfflineStore.getState().refresh();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Durability nudge (addendum §6): unsynced scans live only on THIS device until
  // they reach the server, so a reinstall/wipe would lose them. Warn while any are
  // waiting, and nag harder once the oldest has been sitting for over a day.
  const aging = useMemo(
    () => (oldestPending ? Date.now() - new Date(oldestPending).getTime() > DAY_MS : false),
    [oldestPending],
  );

  const nothingLeft = buckets !== null && buckets.length === 0 && rejected.length === 0;
  // Prefer the live list; fall back to today's cached schedule when offline (§2).
  const effectiveSessions = sessions && sessions.length > 0 ? sessions : cachedSessions;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.lg, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', marginEnd: spacing.sm }}>
          <Icon name="forward" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: '#fff' }}>{t('teacher.reconcile_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{t('teacher.reconcile_subtitle')}</Text>
        </View>
      </LinearGradient>

      {buckets === null ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl4 }} />
      ) : nothingLeft ? (
        <EmptyState icon="success" title={t('teacher.nothing_pending')} message={t('teacher.nothing_pending_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
          {pendingCount > 0 ? <DurabilityBanner count={pendingCount} aging={aging} /> : null}

          {rejected.length > 0 ? <RejectedSection scans={rejected} onChange={load} /> : null}

          {buckets.map((bucket, i) => (
            <BucketCard
              key={`${bucket.startTime}-${i}`}
              bucket={bucket}
              sessions={effectiveSessions}
              onDone={load}
              onSessionsStale={refetchSessions}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** Persistent reminder that unsynced scans only live on this device (addendum §6). */
function DurabilityBanner({ count, aging }: { count: number; aging: boolean }) {
  const { t } = useTranslation();
  const tone = aging
    ? { bg: colors.dangerLight, border: colors.danger, text: colors.dangerText }
    : { bg: colors.warningLight, border: colors.warning, text: colors.warningText };
  return (
    <View
      style={{
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
        backgroundColor: tone.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: tone.border,
        padding: spacing.md, marginBottom: spacing.lg,
      }}
    >
      <Icon name="warning" size={20} color={tone.text} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: tone.text, lineHeight: 20 }}>
        {aging ? t('teacher.durability_warn_aging', { count }) : t('teacher.durability_warn', { count })}
      </Text>
    </View>
  );
}

/**
 * Scans the server permanently rejected (addendum §2): shown distinctly as "needs
 * your decision", never silently re-synced. Each offers two human decisions —
 * dismiss (drop it) or re-queue (try again, typically against a different session).
 */
function RejectedSection({ scans, onChange }: { scans: OfflineScan[]; onChange: () => Promise<void> }) {
  const { t } = useTranslation();

  const dismiss = async (id: number) => {
    await deleteScan(id);
    await onChange();
  };
  const requeue = async (id: number) => {
    await requeueScan(id);
    await onChange();
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.danger,
        padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Icon name="error" size={20} color={colors.dangerText} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.dangerText }}>{t('teacher.rejected_title', { count: scans.length })}</Text>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('teacher.rejected_hint')}</Text>

      <View style={{ gap: spacing.sm }}>
        {scans.map((s) => (
          <View
            key={s.id}
            style={{
              borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md,
              backgroundColor: colors.background,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{s.card_code}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{hhmm(s.scanned_at)}</Text>
            </View>
            {s.last_error ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.dangerText, marginTop: 4 }}>{s.last_error}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TouchableOpacity
                onPress={() => requeue(s.id)}
                activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.primary }}
              >
                <Icon name="refresh" size={16} color={colors.primary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{t('teacher.rejected_requeue')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => dismiss(s.id)}
                activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border }}
              >
                <Icon name="trash" size={16} color={colors.textSecondary} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary }}>{t('teacher.rejected_dismiss')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function BucketCard({
  bucket,
  sessions,
  onDone,
  onSessionsStale,
}: {
  bucket: ScanBucket;
  sessions: TeacherSession[];
  onDone: () => Promise<void>;
  onSessionsStale: () => unknown;
}) {
  const { t } = useTranslation();
  const suggested = useMemo(() => suggestSessionId(bucket, sessions), [bucket, sessions]);
  const [selected, setSelected] = useState<string | null>(suggested);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Item §3: the session these scans were captured for may be gone (cancelled,
  // rescheduled, merged) by the time the teacher reconciles. We never stored a
  // hard target, so "gone" surfaces as: today has sessions, but none fits this
  // bucket's time window — tell the teacher to pick the right one manually.
  const originalMissing = sessions.length > 0 && suggested === null;

  const sync = async () => {
    if (!selected) return;
    setSyncing(true);
    setSummary(null);
    try {
      const res = await syncOfflineBatch(
        Number(selected),
        bucket.scans.map((s) => ({ card_code: s.card_code, scanned_at: s.scanned_at })),
        bucket.teacherId,
      );
      const { synced, rejected } = await applyBatchResults(bucket, res.results);
      setSummary(
        rejected === 0
          ? t('teacher.sync_all_ok', { count: synced })
          : t('teacher.sync_partial', { synced, rejected }),
      );
      await onDone();
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.code;
      if (status === 404 || (status === 422 && e?.response?.data?.errors?.session_instance_id)) {
        // The chosen session no longer exists (deleted/rescheduled between load and
        // submit). Refresh the list and tell the teacher to re-pick (§3).
        await onSessionsStale();
        setSummary(t('teacher.sync_session_gone'));
      } else if (code === 'CONTEXT_MISMATCH') {
        // The chosen session belongs to a different teacher than these scans were
        // stamped for — surface distinctly so the teacher picks the right session.
        setSummary(t('teacher.sync_context_mismatch'));
      } else {
        // Transient (no per-scan verdict): scans stay pending and can retry (§2).
        setSummary(t('teacher.sync_network_error'));
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md, ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
          {hhmm(bucket.startTime)} – {hhmm(bucket.endTime)}
        </Text>
        <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('teacher.scans_count', { count: bucket.scans.length })}</Text>
        </View>
      </View>

      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('teacher.pick_session_for_bucket')}</Text>

      {originalMissing ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }}>
          <Icon name="info" size={16} color={colors.warningText} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.warningText, lineHeight: 18 }}>{t('teacher.original_session_missing')}</Text>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {sessions.length === 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('teacher.no_sessions_today')}</Text>
        ) : (
          sessions.map((s) => {
            const active = selected === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelected(s.id)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  borderWidth: 1.5, borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primaryLight : colors.surface,
                  borderRadius: radius.lg, padding: spacing.md, minHeight: 52,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>
                  {s.course_name ?? '—'}{s.time ? ` · ${s.time}` : ''}
                </Text>
                {active ? <Icon name="success" size={20} color={colors.primary} /> : null}
                {s.id === suggested && !active ? (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t('teacher.suggested')}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {summary ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginTop: spacing.md }}>{summary}</Text>
      ) : null}

      <TouchableOpacity
        onPress={sync}
        disabled={!selected || syncing}
        activeOpacity={0.85}
        style={{
          marginTop: spacing.md, minHeight: 52, borderRadius: radius.lg,
          backgroundColor: selected ? colors.primary : colors.border,
          justifyContent: 'center', alignItems: 'center',
        }}
      >
        {syncing ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.sync_bucket')}</Text>}
      </TouchableOpacity>
    </View>
  );
}
