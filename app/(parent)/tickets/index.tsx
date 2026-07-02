import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useTickets } from '@/hooks/useTickets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

const statusColors: Record<string, [string, string]> = {
  open: ['#6366F1', '#4F46E5'],
  in_progress: ['#F59E0B', '#D97706'],
  resolved: ['#10B981', '#059669'],
  closed: ['#6B7280', '#4B5563'],
};

const priorityIcons: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🔴',
};

export default function TicketsList() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { data: tickets, isLoading, refetch } = useTickets();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: nav.bottomHeight }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
                {t('tickets.title')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                {tickets?.length ?? 0} {t('common.all')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(parent)/tickets/create')}
              activeOpacity={0.7}
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.lg,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>+ {t('tickets.new')}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg, gap: spacing.md }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : !tickets?.length ? (
            <View style={{ alignItems: 'center', padding: spacing.xl4 }}>
              <Text style={{ fontSize: 48, marginBottom: spacing.md }}>{'🎫'}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                {t('tickets.empty')}
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(parent)/tickets/create')}
                style={{ marginTop: spacing.lg }}
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 12, paddingHorizontal: spacing.xxl, borderRadius: radius.md }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
                    {t('tickets.create_first')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            tickets.map((ticket) => {
              const sc = statusColors[ticket.status] || statusColors.open;
              return (
                <TouchableOpacity
                  key={ticket.id}
                  onPress={() => router.push(`/(parent)/tickets/${ticket.id}`)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: colors.white,
                    borderRadius: radius.xl,
                    padding: spacing.lg,
                    ...shadows.sm,
                    borderStartWidth: 4,
                    borderStartColor: sc[0],
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginEnd: spacing.sm }}>
                      <Text
                        style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {ticket.subject}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.regular,
                          fontSize: 13,
                          color: colors.textSecondary,
                          marginTop: 4,
                        }}
                      >
                        {ticket.student_name} - {ticket.teacher_name}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: sc[0] + '20',
                        borderRadius: radius.sm,
                        paddingVertical: 2,
                        paddingHorizontal: spacing.sm,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: sc[0] }}>
                        {t(`tickets.status_${ticket.status}`)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, marginEnd: 4 }}>{priorityIcons[ticket.priority] || '🟡'}</Text>
                      <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>
                        {t(`tickets.priority_${ticket.priority}`)}
                      </Text>
                    </View>
                    {ticket.message_count != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, marginEnd: 4 }}>{'💬'}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>
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
