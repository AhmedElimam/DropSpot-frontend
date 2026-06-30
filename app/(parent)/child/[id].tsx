import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';

const MOCK_CHILDREN = [
  {
    id: '1', name: 'يوسف أحمد', grade: 'الصف الثالث الإعدادي', studentCode: 'STU-2024001',
    attendanceRate: 92, present: 22, absent: 2, excused: 1,
    grades: [
      { course: 'الرياضيات', score: 95, max: 100 },
      { course: 'العلوم', score: 88, max: 100 },
      { course: 'اللغة العربية', score: 92, max: 100 },
      { course: 'اللغة الإنجليزية', score: 85, max: 100 },
      { course: 'التربية الإسلامية', score: 98, max: 100 },
    ],
    recentSessions: [
      { date: '2026-06-28', course: 'الرياضيات', status: 'present' as const },
      { date: '2026-06-26', course: 'العلوم', status: 'present' as const },
      { date: '2026-06-24', course: 'اللغة العربية', status: 'absent' as const },
      { date: '2026-06-22', course: 'الرياضيات', status: 'present' as const },
    ],
  },
  {
    id: '2', name: 'مريم أحمد', grade: 'الصف الأول الإعدادي', studentCode: 'STU-2024002',
    attendanceRate: 88, present: 15, absent: 4, excused: 2,
    grades: [
      { course: 'الرياضيات', score: 90, max: 100 },
      { course: 'العلوم', score: 82, max: 100 },
      { course: 'اللغة العربية', score: 95, max: 100 },
      { course: 'اللغة الإنجليزية', score: 78, max: 100 },
      { course: 'التربية الإسلامية', score: 91, max: 100 },
    ],
    recentSessions: [
      { date: '2026-06-28', course: 'الرياضيات', status: 'present' as const },
      { date: '2026-06-26', course: 'العلوم', status: 'absent' as const },
      { date: '2026-06-24', course: 'اللغة العربية', status: 'present' as const },
      { date: '2026-06-22', course: 'الرياضيات', status: 'late' as const },
    ],
  },
  {
    id: '3', name: 'سارة أحمد', grade: 'الصف الثاني الإعدادي', studentCode: 'STU-2024003',
    attendanceRate: 95, present: 19, absent: 1, excused: 0,
    grades: [
      { course: 'الرياضيات', score: 98, max: 100 },
      { course: 'العلوم', score: 94, max: 100 },
      { course: 'اللغة العربية', score: 96, max: 100 },
      { course: 'اللغة الإنجليزية', score: 92, max: 100 },
      { course: 'التربية الإسلامية', score: 97, max: 100 },
    ],
    recentSessions: [
      { date: '2026-06-28', course: 'الرياضيات', status: 'present' as const },
      { date: '2026-06-26', course: 'العلوم', status: 'present' as const },
      { date: '2026-06-24', course: 'اللغة العربية', status: 'present' as const },
      { date: '2026-06-22', course: 'الرياضيات', status: 'present' as const },
    ],
  },
];

const statusColors: Record<string, string> = {
  present: colors.success,
  absent: colors.danger,
  excused: colors.warning,
  late: colors.warning,
};

type TabKey = 'attendance' | 'grades' | 'settings';

export default function ChildDetailScreen() {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');
  const [showPicker, setShowPicker] = useState(false);

  const child = MOCK_CHILDREN[selectedIndex];
  const avgGrade = child.grades.reduce((s, g) => s + g.score / g.max * 100, 0) / child.grades.length;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'attendance', label: t('reports.attendance') },
    { key: 'grades', label: t('reports.grades') },
    { key: 'settings', label: t('nav.settings') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl4 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ transform: [{ scaleX: -1 }] }}>
                <Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.8)' }}>{'<'}</Text>
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginStart: spacing.sm }}>{t('common.back')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{child.name}</Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginStart: 6 }}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient
              colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', marginEnd: spacing.md }}
            >
              <Text style={{ fontSize: 24, color: '#fff' }}>{(child.name || '?')[0]}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{child.name}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{child.grade} · {child.studentCode}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{child.attendanceRate}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('attendance.attendance_rate')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{Math.round(avgGrade)}%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('quiz.avg_score')}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: '#fff' }}>{child.absent}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{t('attendance.absent')}</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.md, padding: 3 }}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md - 2,
                  backgroundColor: activeTab === tab.key ? colors.white : 'transparent',
                  alignItems: 'center',
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={textPresets.h3}>{t('attendance.attendance_summary')}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.success }}>{child.present}</Text>
                    <Text style={textPresets.caption}>{t('attendance.present')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.danger }}>{child.absent}</Text>
                    <Text style={textPresets.caption}>{t('attendance.absent')}</Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.warning }}>{child.excused}</Text>
                    <Text style={textPresets.caption}>{t('attendance.excused')}</Text>
                  </View>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginBottom: spacing.lg, overflow: 'hidden' }}>
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${child.attendanceRate}%`, height: '100%', borderRadius: 4 }} />
                </View>
                <Text style={[textPresets.bodySmall, { marginBottom: spacing.sm }]}>{t('session.your_sessions')}</Text>
                {child.recentSessions.map((s, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: i < child.recentSessions.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                    <View>
                      <Text style={textPresets.body}>{s.course}</Text>
                      <Text style={textPresets.caption}>{s.date}</Text>
                    </View>
                    <View style={{ backgroundColor: statusColors[s.status] + '20', paddingVertical: 2, paddingHorizontal: 10, borderRadius: radius.full }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: statusColors[s.status] }}>{t(`attendance.${s.status}`)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {activeTab === 'grades' && (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={textPresets.h3}>{t('reports.grades')}</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.borderLight, marginBottom: spacing.lg, overflow: 'hidden' }}>
                  <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${avgGrade}%`, height: '100%', borderRadius: 4 }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 36, color: colors.primary }}>{Math.round(avgGrade)}%</Text>
                  <Text style={[textPresets.bodySmall, { marginStart: spacing.sm }]}>{t('quiz.avg_score')}</Text>
                </View>
                {child.grades.map((g, i) => {
                  const pct = g.score / g.max * 100;
                  return (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: i < child.grades.length - 1 ? 1 : 0, borderBottomColor: colors.borderLight }}>
                      <Text style={[textPresets.body, { flex: 1 }]}>{g.course}</Text>
                      <View style={{ width: 80, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, marginEnd: spacing.md, overflow: 'hidden' }}>
                        <LinearGradient colors={pct >= 90 ? gradients.success : pct >= 75 ? gradients.primary : gradients.warm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: '100%', borderRadius: 3 }} />
                      </View>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: pct >= 90 ? colors.success : pct >= 75 ? colors.primary : colors.warning }}>{g.score}</Text>
                      <Text style={textPresets.caption}>/{g.max}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('child_settings.title')}</Text>
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={textPresets.body}>{t('child_settings.student_code')}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.primary }}>{child.studentCode}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
                    <Text style={textPresets.body}>{t('child_settings.grade_level')}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{child.grade}</Text>
                  </View>
                </View>
              </View>

              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('profile.notifications')}</Text>
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.body}>{t('child_settings.notify_absence')}</Text>
                      <Text style={[textPresets.caption, { marginTop: 2 }]}>{t('child_settings.notify_absence_desc')}</Text>
                    </View>
                    <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignSelf: 'flex-end' }} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.body}>{t('child_settings.notify_grades')}</Text>
                      <Text style={[textPresets.caption, { marginTop: 2 }]}>{t('child_settings.notify_grades_desc')}</Text>
                    </View>
                    <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignSelf: 'flex-end' }} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.body}>{t('child_settings.notify_schedule')}</Text>
                      <Text style={[textPresets.caption, { marginTop: 2 }]}>{t('child_settings.notify_schedule_desc')}</Text>
                    </View>
                    <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colors.borderLight, justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white }} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={textPresets.body}>{t('child_settings.allow_pickup')}</Text>
                      <Text style={[textPresets.caption, { marginTop: 2 }]}>{t('child_settings.allow_pickup_desc')}</Text>
                    </View>
                    <View style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', paddingHorizontal: 3 }}>
                      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignSelf: 'flex-end' }} />
                    </View>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, width: '80%', maxHeight: 300, overflow: 'hidden', ...shadows.lg }}>
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={[textPresets.h3, { textAlign: 'center' }]}>{t('child_settings.switch_child')}</Text>
            </View>
            <FlatList
              data={MOCK_CHILDREN}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  onPress={() => { setSelectedIndex(index); setShowPicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: index === selectedIndex ? colors.primaryLight : 'transparent' }}
                >
                  <LinearGradient colors={['#6366F1', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, color: '#fff' }}>{(item.name || '?')[0]}</Text>
                  </LinearGradient>
                  <View style={{ marginStart: spacing.md, flex: 1 }}>
                    <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{item.name}</Text>
                    <Text style={textPresets.caption}>{item.grade}</Text>
                  </View>
                  {index === selectedIndex && (
                    <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
