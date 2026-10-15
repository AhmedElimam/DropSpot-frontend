import { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';
import { useThreadsFeed, useThreadsRealtime } from '@/hooks/useThreads';
import { ThreadCard } from './ThreadCard';

/**
 * The feed, shared by the student's tab and the teacher's segment. Newest first; a teacher
 * gets a compose button on top and an amber banner while their own switch is still off.
 */
export function ThreadsFeed({ onOpen, onCompose, onSettings, onReports }: {
  onOpen: (id: number) => void;
  onCompose?: () => void;
  onSettings?: () => void;
  onReports?: () => void;
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
  const isTeacher = !!data?.settings;
  const isStaff = !!data?.settings || data?.open_reports !== undefined;

  if (isLoading) return <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.xl4 }} />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const list = data?.threads ?? [];

  return (
    <View style={{ gap: spacing.md }}>
      {isTeacher && data?.settings && !data.settings.enabled ? (
        <TouchableOpacity onPress={onSettings} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: '#EAD9A6' }}>
          <Icon name="eyeOff" size={18} color={colors.warningText} outline />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.warningText, textAlign: 'right' }}>{t('threads.settings_off_banner')}</Text>
          <Icon name="back" size={16} color={colors.warningText} />
        </TouchableOpacity>
      ) : null}

      {isStaff ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {onCompose && isTeacher ? (
            <TouchableOpacity onPress={onCompose} activeOpacity={0.8} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 50, borderRadius: radius.lg, backgroundColor: colors.brand, ...shadows.sm }}>
              <Icon name="add" size={20} color="#fff" />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('threads.compose')}</Text>
            </TouchableOpacity>
          ) : null}
          {onReports ? (
            <TouchableOpacity onPress={onReports} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 50, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: (data?.open_reports ?? 0) > 0 ? colors.warning : colors.border }}>
              <Icon name="flag" size={18} color={(data?.open_reports ?? 0) > 0 ? colors.warning : colors.textSecondary} outline />
              {(data?.open_reports ?? 0) > 0 ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.warningText }}>{data?.open_reports}</Text> : null}
            </TouchableOpacity>
          ) : null}
          {onSettings && isTeacher ? (
            <TouchableOpacity onPress={onSettings} activeOpacity={0.8} style={{ alignItems: 'center', justifyContent: 'center', minHeight: 50, width: 50, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <Icon name="settings" size={18} color={colors.textSecondary} outline />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {list.length === 0 ? (
        <EmptyState icon="threads" title={t('threads.empty_title')} message={isTeacher ? t('threads.empty_teacher') : t('threads.empty_student')} />
      ) : (
        list.map((th) => <ThreadCard key={th.id} thread={th} onOpen={onOpen} showTeacher={!isStaff} />)
      )}
    </View>
  );
}
