import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients, nav } from '@/theme/index';
import { useTeacherTodaySessions } from '@/hooks/useTeacherSessions';
import type { TeacherSession } from '@/api/teacher';
import { syncOfflineBatch } from '@/api/teacher';
import { getPendingScans, deleteScans, markScanFailed } from '@/db/offlineScans';
import { computeBuckets, type ScanBucket } from '@/db/buckets';
import { useOfflineStore } from '@/stores/offlineStore';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';

function hhmm(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

/** Suggest the session whose window contains the bucket's start time. */
function suggestSession(bucket: ScanBucket, sessions: TeacherSession[]): string | null {
  const start = new Date(bucket.startTime).getTime();
  for (const s of sessions) {
    if (!s.scheduled_at) continue;
    const sched = new Date(s.scheduled_at).getTime();
    if (Number.isNaN(sched)) continue;
    const open = sched - 30 * 60_000;
    const close = sched + (s.duration_minutes ?? 60) * 60_000;
    if (start >= open && start <= close) return s.id;
  }
  return null;
}

export default function Reconcile() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: sessions } = useTeacherTodaySessions();
  const [buckets, setBuckets] = useState<ScanBucket[] | null>(null);

  const load = useCallback(async () => {
    const pending = await getPendingScans();
    setBuckets(computeBuckets(pending));
    await useOfflineStore.getState().refresh();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      ) : buckets.length === 0 ? (
        <EmptyState icon="success" title={t('teacher.nothing_pending')} message={t('teacher.nothing_pending_hint')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom }} showsVerticalScrollIndicator={false}>
          {buckets.map((bucket, i) => (
            <BucketCard key={`${bucket.startTime}-${i}`} bucket={bucket} sessions={sessions ?? []} onDone={load} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function BucketCard({ bucket, sessions, onDone }: { bucket: ScanBucket; sessions: TeacherSession[]; onDone: () => Promise<void> }) {
  const { t } = useTranslation();
  const suggested = useMemo(() => suggestSession(bucket, sessions), [bucket, sessions]);
  const [selected, setSelected] = useState<string | null>(suggested);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const sync = async () => {
    if (!selected) return;
    setSyncing(true);
    setSummary(null);
    try {
      const res = await syncOfflineBatch(
        Number(selected),
        bucket.scans.map((s) => ({ card_code: s.card_code, scanned_at: s.scanned_at })),
      );
      // Results come back in submitted order — zip to local rows.
      const toDelete: number[] = [];
      let failed = 0;
      res.results.forEach((r, idx) => {
        const local = bucket.scans[idx];
        if (!local) return;
        if (r.outcome === 'synced' || r.outcome === 'already_recorded') {
          toDelete.push(local.id);
        } else {
          failed++;
          markScanFailed(local.id, r.message || r.code || 'failed');
        }
      });
      await deleteScans(toDelete);
      setSummary(
        failed === 0
          ? t('teacher.sync_all_ok', { count: res.synced })
          : t('teacher.sync_partial', { synced: res.synced, failed }),
      );
      await onDone();
    } catch {
      setSummary(t('teacher.sync_network_error'));
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
