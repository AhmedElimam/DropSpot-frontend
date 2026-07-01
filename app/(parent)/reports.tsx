import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';

const MOCK_CHILDREN = [
  { id: '1', name: 'يوسف أحمد', grade: 'الصف الثالث الإعدادي', attendanceRate: 92, present: 22, absent: 2, excused: 1, avgScore: 92 },
  { id: '2', name: 'مريم أحمد', grade: 'الصف الأول الإعدادي', attendanceRate: 88, present: 15, absent: 4, excused: 2, avgScore: 87 },
  { id: '3', name: 'سارة أحمد', grade: 'الصف الثاني الإعدادي', attendanceRate: 95, present: 19, absent: 1, excused: 0, avgScore: 95 },
];

type TabKey = 'attendance' | 'grades';

export default function ReportsScreen() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');

  const totalPresent = MOCK_CHILDREN.reduce((s, c) => s + c.present, 0);
  const totalAbsent = MOCK_CHILDREN.reduce((s, c) => s + c.absent, 0);
  const totalExcused = MOCK_CHILDREN.reduce((s, c) => s + c.excused, 0);
  const overallRate = Math.round((totalPresent / (totalPresent + totalAbsent + totalExcused)) * 100);
  const overallAvg = Math.round(MOCK_CHILDREN.reduce((s, c) => s + c.avgScore, 0) / MOCK_CHILDREN.length);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'attendance', label: t('reports.attendance') },
    { key: 'grades', label: t('reports.grades') },
  ];

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
            {MOCK_CHILDREN.length} {t('nav.children')}
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
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.lg }}>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.success }}>{totalPresent}</Text>
                    <Text style={textPresets.caption}>{t('attendance.present')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.danger }}>{totalAbsent}</Text>
                    <Text style={textPresets.caption}>{t('attendance.absent')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.warning }}>{totalExcused}</Text>
                    <Text style={textPresets.caption}>{t('attendance.excused')}</Text>
                  </View>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallRate}%`, height: '100%', borderRadius: 4 }} />
                </View>
              </View>

              {MOCK_CHILDREN.map((child, i) => (
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
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: child.attendanceRate >= 90 ? colors.success : colors.warning }}>
                      {child.attendanceRate}%
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginTop: spacing.md, overflow: 'hidden' }}>
                    <LinearGradient colors={child.attendanceRate >= 90 ? gradients.success : gradients.warm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${child.attendanceRate}%`, height: '100%', borderRadius: 3 }} />
                  </View>
                </TouchableOpacity>
              ))}
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
                  <LinearGradient colors={overallAvg >= 90 ? gradients.success : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${overallAvg}%`, height: '100%', borderRadius: 4 }} />
                </View>
              </View>

              {MOCK_CHILDREN.map((child) => (
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
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: child.avgScore >= 90 ? colors.success : colors.primary }}>
                      {child.avgScore}%
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginTop: spacing.md, overflow: 'hidden' }}>
                    <LinearGradient colors={child.avgScore >= 90 ? gradients.success : gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${child.avgScore}%`, height: '100%', borderRadius: 3 }} />
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
