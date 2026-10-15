import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useAuthStore } from '@/stores/authStore';
import { useThreadsFeed, useThreadsRealtime } from '@/hooks/useThreads';
import { ThreadCard } from './ThreadCard';
import { InitialsAvatar } from './Avatar';
import { arDigits, filterCounts, matchesFilter, stateOf, type ThreadFilter } from './format';

/**
 * حكاوي's feed, shared by the student's tab and the teacher's segment. Newest first, with
 * client-side filter chips (open / waiting for the teacher / answered / تكات). A teacher gets
 * a social composer on top and — while their own switch is off — an amber card that says
 * their students see nothing yet. Settings and the reports queue live in the page hero.
 */
export function ThreadsFeed({ onOpen, onCompose, onSettings }: {
  onOpen: (id: number) => void;
  onCompose?: (kind: 'question' | 'note') => void;
  onSettings?: () => void;
}) {
  const { t } = useTranslation();
  const focused = useIsFocused();
  // The socket's real state slows the poll to a safety net (see useThreadsFeed); the two hooks
  // meet through this flag because the socket needs the feed's own `realtime` settings.
  const [live, setLive] = useState(false);
  const { data, isLoading, isError, refetch } = useThreadsFeed(true, live);
  const channels = useMemo(() => data?.channels ?? [], [data?.channels]);
  const { connected } = useThreadsRealtime(data?.realtime, channels, focused);
  useEffect(() => { setLive(connected); }, [connected]);
  const [filter, setFilter] = useState<ThreadFilter>('all');

  // The cards are memoised; hand them ONE callback for the feed's life, whatever the parent passes.
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const open = useCallback((id: number) => openRef.current(id), []);

  const list = useMemo(() => data?.threads ?? [], [data?.threads]);
  const counts = useMemo(() => filterCounts(list), [list]);
  const shown = useMemo(() => (filter === 'all' ? list : list.filter((th) => matchesFilter(stateOf(th), filter))), [list, filter]);
  // A filter whose last post just went away falls back to everything.
  useEffect(() => { if (filter !== 'all' && counts[filter] === 0) setFilter('all'); }, [counts, filter]);

  const isTeacher = !!data?.settings;
  const isStaff = isTeacher || data?.open_reports !== undefined;

  if (isLoading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const chips: { key: ThreadFilter; label: string; icon: IconName }[] = [
    { key: 'all', label: t('threads.filter_all'), icon: 'threads' },
    { key: 'open', label: t('threads.filter_open'), icon: 'timer' },
    { key: 'waiting', label: isStaff ? t('threads.filter_waiting_teacher') : t('threads.filter_waiting'), icon: 'hourglass' },
    { key: 'answered', label: t('threads.filter_answered'), icon: 'success' },
    ...(counts.notes > 0 ? [{ key: 'notes' as const, label: t('threads.filter_notes'), icon: 'lightbulb' as const }] : []),
  ];

  return (
    <View style={{ gap: spacing.md }}>
      {isTeacher && data?.settings && !data.settings.enabled ? <OffCard onPress={onSettings} /> : null}

      {isStaff && !isTeacher ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint }}>
          <Icon name="shield" size={17} color={colors.brand} />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 19, color: colors.textPrimary }}>{t('threads.assistant_note')}</Text>
        </View>
      ) : null}

      {isTeacher && onCompose ? (
        <ComposerRow
          teacher={list[0]?.teacher}
          onQuestion={() => onCompose('question')}
          onNote={() => onCompose('note')}
        />
      ) : null}

      {list.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 }}
        >
          {chips.map((c) => (
            <FilterChip key={c.key} label={c.label} icon={c.icon} count={counts[c.key]} active={filter === c.key} onPress={() => setFilter(c.key)} />
          ))}
        </ScrollView>
      ) : null}

      {list.length === 0 ? (
        <EmptyFeed teacher={isTeacher} onCompose={onCompose ? () => onCompose('question') : undefined} />
      ) : shown.length === 0 ? (
        <Animated.Text entering={FadeIn.duration(200)} style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xl }}>
          {t('threads.filter_empty')}
        </Animated.Text>
      ) : (
        shown.map((th, i) => <ThreadCard key={th.id} thread={th} onOpen={open} staff={isStaff} index={i} />)
      )}
    </View>
  );
}

function FilterChip({ label, icon, count, active, onPress }: { label: string; icon: IconName; count: number; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={() => { if (!active) onPress(); }}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: spacing.md, borderRadius: radius.full,
        backgroundColor: active ? colors.brand : colors.surface, borderWidth: 1, borderColor: active ? colors.brand : colors.border,
      }}
    >
      <Icon name={icon} size={14} color={active ? colors.onPrimary : colors.textTertiary} outline={!active} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: active ? colors.onPrimary : colors.textSecondary }}>{label}</Text>
      {count > 0 ? (
        <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? 'rgba(255,255,255,0.22)' : colors.surfaceSunken }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: active ? colors.onPrimary : colors.textTertiary }}>{arDigits(count)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** The teacher's «what's on your mind»: one tap to a question, one to a تكة. */
function ComposerRow({ teacher, onQuestion, onNote }: { teacher?: { id: number; name: string }; onQuestion: () => void; onNote: () => void }) {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const who = teacher ?? (me ? { id: me.id, name: me.name } : { id: 0, name: '' });
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.md, ...shadows.sm }}>
      <TouchableOpacity onPress={onQuestion} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t('threads.compose')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <InitialsAvatar id={who.id} name={who.name} size={42} />
        <View style={{ flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary }} numberOfLines={1}>{t('threads.composer_prompt')}</Text>
        </View>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <QuickAction icon="question" label={t('threads.kind_question')} tint={colors.brandTint} ink={colors.brand} onPress={onQuestion} />
        <QuickAction icon="lightbulb" label={t('threads.kind_note')} tint={colors.accentWarmTint} ink={colors.accentText} onPress={onNote} />
      </View>
    </Animated.View>
  );
}

function QuickAction({ icon, label, tint, ink, onPress }: { icon: IconName; label: string; tint: string; ink: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: radius.md, backgroundColor: tint }}>
      <Icon name={icon} size={17} color={ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: ink }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** The teacher's own switch is off: their students see nothing. Warm, not alarming. */
function OffCard({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.xl, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: colors.warning }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="eyeOff" size={19} color={colors.warning} outline />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.warningText }}>{t('threads.settings_off_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.warningText }}>{t('threads.settings_off_banner')}</Text>
      </View>
      {onPress ? (
        <View style={{ paddingHorizontal: spacing.md, height: 32, borderRadius: radius.full, backgroundColor: colors.warning, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#FFFFFF' }}>{t('threads.settings_off_cta')}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Nothing posted yet: three tokens of what حكاوي holds — a question, a tip, the spark of a
 * good answer — leaning on each other, then a line for this reader.
 */
function EmptyFeed({ teacher, onCompose }: { teacher: boolean; onCompose?: () => void }) {
  const { t } = useTranslation();
  const bubble = (icon: IconName, bg: string, ink: string, size: number, tilt: string, lift = 0) => (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: tilt }, { translateY: lift }], borderWidth: 3, borderColor: colors.background }}>
      <Icon name={icon} size={size * 0.44} color={ink} />
    </View>
  );
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: radius.xxl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg }}>
        {bubble('lightbulb', colors.accentWarm, colors.onAccent, 58, '-10deg', 6)}
        <View style={{ marginHorizontal: -10, zIndex: 1 }}>{bubble('question', colors.brand, colors.onPrimary, 80, '0deg')}</View>
        {bubble('sparkles', colors.success, colors.onPrimary, 54, '12deg', 10)}
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'center' }}>{teacher ? t('threads.empty_teacher_title') : t('threads.empty_title')}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
        {teacher ? t('threads.empty_teacher') : t('threads.empty_student')}
      </Text>
      {teacher && onCompose ? (
        <TouchableOpacity onPress={onCompose} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, paddingHorizontal: spacing.xl, height: 46, borderRadius: radius.full, backgroundColor: colors.brand }}>
          <Icon name="add" size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#FFFFFF' }}>{t('threads.empty_teacher_cta')}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}
