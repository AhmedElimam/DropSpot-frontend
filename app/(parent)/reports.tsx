import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, nav } from '@/theme/index';
import { useChildren } from '@/hooks/useChildren';

type TabKey = 'attendance' | 'grades';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const { data: children, isLoading } = useChildren();

  const rates = (children ?? []).map((c) => c.attendance_rate ?? 0);
  const overallRate = rates.length > 0 ? Math.round(rates.reduce((s, r) => s + r, 0) / rates.length) : 0;
  const overallAvg = overallRate;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'attendance', label: t('reports.attendance') },
    { key: 'grades', label: t('reports.grades') },
  ];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#1E1B4B', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.white, letterSpacing: -0.5 }}>
            {t('reports.title')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
            {children?.length ?? 0} {t('nav.children')}
          </Text>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{overallRate}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('attendance.attendance_rate')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#fff' }}>{overallAvg}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{t('quiz.avg_score')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.md, padding: 3 }}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md - 2,
                  backgroundColor: activeTab === tab.key ? colors.white : 'transparent', alignItems: 'center',
                  ...(activeTab === tab.key ? shadows.sm : {}),
                }}
              >
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: activeTab === tab.key ? colors.primary : colors.textSecondary }}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {activeTab === 'attendance' && (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('attendance.attendance_summary')}</Text>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginTop: spacing.md, marginBottom: spacing.lg, overflow: 'hidden' }}>
                  <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallRate}%`, height: '100%', borderRadius: 4 }} />
                </View>
              </View>

              {children?.map((child, i) => {
                const rate = child.attendance_rate ?? 0;
                return (
                  <TouchableOpacity
                    key={child.id}
                    onPress={() => router.push(`/(parent)/child/${child.id}`)}
                    activeOpacity={0.7}
                    style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                      </LinearGradient>
                      <View style={{ marginStart: spacing.md, flex: 1 }}>
                        <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{child.name}</Text>
                        <Text style={textPresets.caption}>{child.grade}</Text>
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: rate >= 90 ? colors.success : colors.warning }}>
                        {rate}%
                      </Text>
                    </View>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginTop: spacing.md, overflow: 'hidden' }}>
                      <LinearGradient colors={rate >= 90 ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${rate}%`, height: '100%', borderRadius: 3 }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('reports.grade_summary')}</Text>
                <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 40, color: colors.primary }}>{overallAvg}%</Text>
                  <Text style={textPresets.bodySmall}>{t('quiz.avg_score')}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                  <LinearGradient colors={overallAvg >= 90 ? ['#10B981', '#059669'] : ['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallAvg}%`, height: '100%', borderRadius: 4 }} />
                </View>
              </View>

              {children?.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  onPress={() => router.push(`/(parent)/child/${child.id}`)}
                  activeOpacity={0.7}
                  style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, color: '#fff' }}>{(child.name || '?')[0]}</Text>
                    </LinearGradient>
                    <View style={{ marginStart: spacing.md, flex: 1 }}>
                      <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{child.name}</Text>
                      <Text style={textPresets.caption}>{child.grade}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.primary }}>
                      {child.attendance_rate ?? 0}%
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}