import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useChildren } from '@/hooks/useChildren';
import { useNotifications, useUnreadCount } from '@/hooks/useNotifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timeAgo, filterByTime, TIME_FILTERS } from '@/utils/format';
import type { TimeFilter } from '@/utils/format';

const typeConfig: Record<string, { icon: string; gradient: readonly [string, string] }> = {
  absence: { icon: '⚠️', gradient: ['#EF4444', '#DC2626'] },
  grade: { icon: '🎯', gradient: ['#10B981', '#059669'] },
  invoice: { icon: '💳', gradient: ['#F59E0B', '#D97706'] },
  schedule: { icon: '📅', gradient: ['#6366F1', '#4F46E5'] },
};

const quickActions = [
  { icon: '👨‍👩‍👧‍👦', label: 'nav.children', route: '/(parent)/children', gradient: ['#6366F1', '#8B5CF6'] as const },
  { icon: '💳', label: 'nav.invoices', route: '/(parent)/invoices', gradient: ['#10B981', '#059669'] as const },
  { icon: '📊', label: 'nav.reports', route: '/(parent)/reports', gradient: ['#6366F1', '#8B5CF6'] as const },
  { icon: '📊', label: 'activity.title', route: '', gradient: ['#F59E0B', '#D97706'] as const },
];

export default function ParentHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data: children } = useChildren();
  const { data: notifications, isLoading: notifLoading } = useNotifications();
  const { data: unreadCount } = useUnreadCount();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const filteredNotifications = filterByTime(notifications ?? [], timeFilter);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4 + insets.top, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                {t('common.greeting', { name: user?.name || '' })}
              </Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: '#fff', letterSpacing: -0.5, marginTop: 2 }}>
                {user?.name || 'ولي الأمر'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4, direction: 'ltr', textAlign: 'left' }}>
                {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
            <View style={{ position: 'relative' }}>
              <LinearGradient
                colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <Text style={{ fontSize: 22 }}>🔔</Text>
              </LinearGradient>
              {(unreadCount ?? 0) > 0 && (
                <View style={{ position: 'absolute', top: -4, start: -4, backgroundColor: colors.danger, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#1E1B4B' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{children?.length ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('nav.children')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{unreadCount ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('notifications.title')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{notifications?.length ?? 0}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('activity.title')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {quickActions.map((action, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { if (action.route) router.push(action.route as any); }}
                activeOpacity={0.8}
                style={{ width: '48%', backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden', ...shadows.md }}
              >
                <LinearGradient colors={['rgba(255,255,255,0.9)', 'rgba(248,250,252,0.95)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: spacing.lg, alignItems: 'center' }}>
                  <LinearGradient colors={action.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: 22 }}>{action.icon}</Text>
                  </LinearGradient>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t(action.label)}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {children && children.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
            <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
              <Text style={textPresets.h3}>{t('home.performance_title')}</Text>
              <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={textPresets.caption}>{'📊'} {t('attendance.attendance_rate')}</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(parent)/reports')}
                    style={{ marginTop: spacing.xs, backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.primary }}>
                      {Math.max(...children.map((c) => c.attendance_rate ?? 0))}%
                    </Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>
                      {children.sort((a, b) => (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0))[0]?.name}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={textPresets.caption}>{'🏆'} {t('quiz.avg_score')}</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/(parent)/reports')}
                    style={{ marginTop: spacing.xs, backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.success }}>—%</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: colors.textSecondary, marginTop: 1 }}>
                      {t('reports.view_details')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {children.map((child) => (
                <View key={child.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                  <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.sm }}>
                    <Text style={{ fontSize: 13, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                  </LinearGradient>
                  <Text style={[textPresets.body, { flex: 1, fontFamily: fonts.medium }]}>{child.name}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: (child.attendance_rate ?? 0) >= 90 ? colors.success : colors.warning }}>
                    {child.attendance_rate ?? 0}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={textPresets.h3}>{t('activity.title')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }}>{t('reports.view_details')}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
            {TIME_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setTimeFilter(f.key)}
                style={{
                  paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.full,
                  backgroundColor: timeFilter === f.key ? colors.primary : colors.borderLight,
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: timeFilter === f.key ? '#fff' : colors.textSecondary }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ gap: spacing.sm }}>
            {notifLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : !filteredNotifications.length ? (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', padding: spacing.xl }}>
                {notifications?.length ? t('notifications.empty') : t('notifications.empty')}
              </Text>
            ) : (
              filteredNotifications.map((notification: any) => {
                const cfg = typeConfig[notification.type] || typeConfig.schedule;
                const nd = notification.data ?? {};
                return (
                  <TouchableOpacity
                    key={notification.id}
                    activeOpacity={0.7}
                    style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.lg, ...shadows.sm, borderStartWidth: 3, borderStartColor: cfg.gradient[0], opacity: notification.is_read ? 0.65 : 1 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <LinearGradient colors={cfg.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md }}>
                        <Text style={{ fontSize: 16 }}>{cfg.icon}</Text>
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          {nd.student_name ? (
                            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{nd.student_name}</Text>
                          ) : null}
                          {!notification.is_read && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cfg.gradient[0] }} />}
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{notification.title}{notification.body ? `: ${notification.body}` : ''}</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 2, flexWrap: 'wrap' }}>
                          {nd.teacher_name && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, marginEnd: 2 }}>{'👨‍🏫'}</Text>
                              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textTertiary }}>{nd.teacher_name}</Text>
                            </View>
                          )}
                          {nd.location && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, marginEnd: 2 }}>{'📍'}</Text>
                              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textTertiary }}>{nd.location}</Text>
                            </View>
                          )}
                          {nd.course_name && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, marginEnd: 2 }}>{'📚'}</Text>
                              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textTertiary }}>{nd.course_name}</Text>
                            </View>
                          )}
                          {nd.notes && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 10, marginEnd: 2 }}>{'📝'}</Text>
                              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textTertiary }}>{nd.notes}</Text>
                            </View>
                          )}
                          {nd.percentage !== undefined && nd.percentage !== null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: (nd.percentage ?? 0) >= 75 ? colors.successLight : colors.dangerLight, paddingVertical: 1, paddingHorizontal: 6, borderRadius: radius.full }}>
                              <Text style={{ fontSize: 10, marginEnd: 2 }}>{'🎯'}</Text>
                              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: (nd.percentage ?? 0) >= 75 ? colors.success : colors.danger }}>{nd.score ?? '?'}/{nd.max_score ?? '?'} ({nd.percentage}%)</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textTertiary, marginTop: 4 }}>{timeAgo(notification.created_at)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
