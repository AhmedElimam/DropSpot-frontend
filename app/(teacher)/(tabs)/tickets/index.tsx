import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { useTickets } from '@/hooks/useTickets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Icon } from '@/components/ui/Icon';

// Left-edge accent per ticket state.
const statusColors: Record<string, [string, string]> = {
  open: [colors.brand, colors.brandDeep],
  in_progress: [colors.warning, colors.warningDark],
  resolved: [colors.success, colors.successDark],
  closed: [colors.textTertiary, colors.textSecondary],
};

const priorityColors: Record<string, string> = {
  low: colors.success,
  medium: colors.warning,
  high: colors.danger,
};

// Teacher-side ticket list. Teachers respond to tickets (parents create them),
// so there is no "new ticket" action here. Reuses the shared ticket hooks/API.
export default function TeacherTicketsList() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: tickets, isLoading, isError, refetch } = useTickets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
            {t('tickets.title')}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
            {t('tickets.count', { count: tickets?.length ?? 0 })}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : !tickets?.length ? (
            <EmptyState icon="tickets" title={t('tickets.empty')} />
          ) : (
            tickets.map((ticket) => {
              const sc = statusColors[ticket.status] || statusColors.open;
              return (
                <TouchableOpacity
                  key={ticket.id}
                  onPress={() => router.push(`/(teacher)/tickets/${ticket.id}`)}
                  activeOpacity={0.75}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    ...shadows.sm,
                    borderStartWidth: 4,
                    borderStartColor: sc[0],
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginEnd: spacing.sm }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: colors.textPrimary }} numberOfLines={1}>
                        {ticket.subject}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.textSecondary, marginTop: 4 }}>
                        {ticket.student_name}{ticket.parent_name ? ` · ${ticket.parent_name}` : ''}
                      </Text>
                    </View>
                    <StatusBadge status={ticket.status} />
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: priorityColors[ticket.priority] || colors.warning, marginEnd: 6 }} />
                      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>
                        {t(`tickets.priority_${ticket.priority}`)}
                      </Text>
                    </View>
                    {ticket.message_count != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon name="ticket" size={14} color={colors.textTertiary} outline style={{ marginEnd: 4 }} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>
                          {ticket.message_count}
                        </Text>
                      </View>
                    )}
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
