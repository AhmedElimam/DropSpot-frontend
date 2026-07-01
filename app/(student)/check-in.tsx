import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';

const { width } = Dimensions.get('window');

const MOCK_SESSIONS = [
  { id: '1', course_name: 'الرياضيات', teacher_name: 'أحمد محمد', time: '10:00 - 11:30', disabled: true },
  { id: '2', course_name: 'العلوم', teacher_name: 'سارة علي', time: '12:30 - 14:00' },
];

const MOCK_COVERAGE = [
  { date: '2026-06-25', course: 'الرياضيات', status: 'present' as const },
  { date: '2026-06-24', course: 'العلوم', status: 'present' as const },
  { date: '2026-06-23', course: 'الرياضيات', status: 'absent' as const },
  { date: '2026-06-22', course: 'اللغة العربية', status: 'excused' as const },
  { date: '2026-06-21', course: 'العلوم', status: 'present' as const },
];

const coverageColors: Record<string, string> = {
  present: colors.success,
  absent: colors.danger,
  excused: colors.warning,
};

const coverageLabels: Record<string, string> = {
  present: 'attendance.present',
  absent: 'attendance.absent',
  excused: 'attendance.excused',
};

const MOCK_ALTERNATIVES = [
  { date: '2026-07-02', day: 'الخميس', slots: 3, total: 10 },
  { date: '2026-07-03', day: 'الجمعة', slots: 0, total: 10 },
  { date: '2026-07-06', day: 'الإثنين', slots: 5, total: 10 },
  { date: '2026-07-07', day: 'الثلاثاء', slots: 8, total: 10 },
];

type ModalType = 'excuse' | 'report' | 'reschedule' | null;

export default function CheckInTab() {
  const { t } = useTranslation();
  const activeSessions = MOCK_SESSIONS.filter((s) => !s.disabled);
  const [selectedSession, setSelectedSession] = useState(activeSessions[0]?.id ?? '');
  const [checkedIn, setCheckedIn] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [excuseText, setExcuseText] = useState('');
  const [reportText, setReportText] = useState('');
  const [showCoverage, setShowCoverage] = useState(true);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rescheduleSent, setRescheduleSent] = useState(false);

  if (checkedIn) {
    return (
      <LinearGradient
        colors={['#EEF2FF', '#F8FAFC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl }}
      >
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.white,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: spacing.xl,
            ...shadows.glow,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.successLight,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 36, color: colors.success }}>{'✓'}</Text>
          </View>
        </View>
        <Text style={[textPresets.h1, { textAlign: 'center', marginBottom: spacing.sm }]}>
          {t('attendance.check_in_success_title')}
        </Text>
        <Text style={[textPresets.body, { textAlign: 'center', color: colors.textSecondary }]}>
          {t('attendance.check_in_success_desc', { course: 'الرياضيات' })}
        </Text>
        <Text style={[textPresets.bodySmall, { marginTop: spacing.sm }]}>
          {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <TouchableOpacity
          onPress={() => setCheckedIn(false)}
          style={{
            marginTop: spacing.xxl,
            paddingVertical: 14,
            paddingHorizontal: spacing.xxxl,
            borderRadius: radius.md,
            backgroundColor: colors.white,
            ...shadows.sm,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>
            {t('common.back')}
          </Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('attendance.check_in')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: spacing.xs }}>
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              marginTop: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.white }}>{MOCK_SESSIONS.length}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                {t('session.today_sessions')}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.white }}>80%</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                {t('attendance.coverage_rate')}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.md,
                padding: spacing.md,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.white }}>1</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                {t('attendance.absent')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl4, gap: spacing.md }}>
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: radius.xl,
              padding: spacing.xl,
              ...shadows.md,
            }}
          >
            <Text style={[textPresets.h3, { marginBottom: spacing.lg }]}>
              {t('attendance.select_session')}
            </Text>

            {MOCK_SESSIONS.map((session) => {
              const isSelected = selectedSession === session.id;
              const isDisabled = session.disabled;
              return (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => { if (!isDisabled) setSelectedSession(session.id); }}
                  disabled={isDisabled}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: isSelected ? colors.primaryLight : colors.background,
                    marginBottom: spacing.sm,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : isDisabled ? colors.dangerLight : 'transparent',
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: isSelected ? colors.primary : isDisabled ? colors.danger : colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginEnd: spacing.md,
                    }}
                  >
                    {isSelected && (
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[textPresets.subtitle, isDisabled && { color: colors.textTertiary }]}>{session.course_name}</Text>
                    <Text style={[textPresets.bodySmall, { marginTop: 2 }, isDisabled && { color: colors.textTertiary }]}>{session.teacher_name} · {session.time}</Text>
                  </View>
                  {isDisabled && (
                    <View style={{ backgroundColor: colors.dangerLight, paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.danger, textAlign: 'center' }}>انتهت</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => setCheckedIn(true)}
            disabled={!selectedSession}
            activeOpacity={0.85}
            style={{ borderRadius: radius.md, overflow: 'hidden', opacity: !selectedSession ? 0.4 : 1 }}
          >
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.white, letterSpacing: 0.5 }}>
                {t('attendance.check_in_now')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity
              onPress={() => setActiveModal('excuse')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: radius.md,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: spacing.lg, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 24, marginBottom: spacing.xs }}>{'📝'}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>
                  {t('attendance.excuse')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveModal('report')}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: radius.md,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: spacing.lg, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 24, marginBottom: spacing.xs }}>{'⚠️'}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>
                  {t('attendance.report_problem')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowCoverage(!showCoverage)}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: radius.md,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#6366F1', '#4F46E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: spacing.lg, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 24, marginBottom: spacing.xs }}>{'📊'}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>
                  {t('attendance.coverage')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setActiveModal('reschedule'); setSelectedDate(null); setRescheduleReason(''); setRescheduleSent(false); }}
              activeOpacity={0.8}
              style={{
                flex: 1,
                borderRadius: radius.md,
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={['#06B6D4', '#0891B2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ padding: spacing.lg, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 24, marginBottom: spacing.xs }}>{'🔄'}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.white }}>
                  {t('session.reschedule')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {showCoverage && (
            <View
              style={{
                backgroundColor: colors.white,
                borderRadius: radius.xl,
                padding: spacing.xl,
                ...shadows.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
                <Text style={textPresets.h3}>{t('attendance.coverage')}</Text>
                <Text style={textPresets.bodySmall}>{t('attendance.coverage_this_month')}</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.success }}>3</Text>
                  <Text style={textPresets.caption}>{t('attendance.coverage_present')}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.dangerLight, borderRadius: radius.md, padding: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.danger }}>1</Text>
                  <Text style={textPresets.caption}>{t('attendance.coverage_absent')}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.warning }}>1</Text>
                  <Text style={textPresets.caption}>{t('attendance.coverage_excused')}</Text>
                </View>
              </View>

              {MOCK_COVERAGE.map((record) => (
                <View
                  key={record.date}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderLight,
                  }}
                >
                  <View>
                    <Text style={textPresets.body}>{record.course}</Text>
                    <Text style={textPresets.caption}>
                      {new Date(record.date).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: coverageColors[record.status] + '20',
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.full,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: coverageColors[record.status] }}>
                      {t(coverageLabels[record.status])}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={activeModal === 'excuse'} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setActiveModal(null); setExcuseText(''); }} />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              padding: spacing.xxl,
              paddingBottom: spacing.xl5,
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl }} />
            <Text style={textPresets.h2}>{t('attendance.excuse_title')}</Text>
            <Text style={[textPresets.bodySmall, { marginBottom: spacing.xl }]}>
              {t('session.course')}: الرياضيات
            </Text>

            <TextInput
              value={excuseText}
              onChangeText={setExcuseText}
              placeholder={t('attendance.excuse_placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              style={{
                fontFamily: fonts.regular,
                fontSize: 14,
                backgroundColor: colors.background,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginBottom: spacing.lg,
                color: colors.textPrimary,
                textAlign: 'right',
                minHeight: 100,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <TouchableOpacity
              onPress={() => { setActiveModal(null); setExcuseText(''); }}
              disabled={!excuseText.trim()}
              activeOpacity={0.85}
              style={{ borderRadius: radius.md, overflow: 'hidden', opacity: !excuseText.trim() ? 0.5 : 1 }}
            >
              <LinearGradient colors={gradients.warm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>
                  {t('attendance.excuse_submit')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'reschedule'} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setActiveModal(null); setRescheduleReason(''); setSelectedDate(null); }} />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              padding: spacing.xxl,
              paddingBottom: spacing.xl5,
              maxHeight: '80%',
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl }} />

            {rescheduleSent ? (
              <>
                <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                  <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                    <Text style={{ fontSize: 36, color: colors.success }}>{'✓'}</Text>
                  </View>
                  <Text style={textPresets.h2}>{t('session.request_sent')}</Text>
                  <Text style={[textPresets.bodySmall, { textAlign: 'center', marginTop: spacing.sm }]}>
                    {t('session.proposed_time')}: {selectedDate ? MOCK_ALTERNATIVES.find((a) => a.date === selectedDate)?.day : ''} {selectedDate}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setActiveModal(null)}
                  style={{ marginTop: spacing.md, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>{t('common.back')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={textPresets.h2}>{t('session.reschedule_request')}</Text>
                <Text style={[textPresets.bodySmall, { marginBottom: spacing.lg }]}>
                  {t('session.course')}: العلوم · {t('session.teacher')}: سارة علي
                </Text>

                <Text style={[textPresets.label, { marginBottom: spacing.sm }]}>{t('session.proposed_time')}</Text>
                {MOCK_ALTERNATIVES.map((alt) => {
                  const isFull = alt.slots === 0;
                  const isSelected = selectedDate === alt.date;
                  return (
                    <TouchableOpacity
                      key={alt.date}
                      onPress={() => { if (!isFull) setSelectedDate(alt.date); }}
                      disabled={isFull}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: spacing.md,
                        borderRadius: radius.md,
                        backgroundColor: isSelected ? colors.primaryLight : colors.background,
                        marginBottom: spacing.sm,
                        borderWidth: 1.5,
                        borderColor: isSelected ? colors.primary : isFull ? colors.dangerLight : 'transparent',
                        opacity: isFull ? 0.45 : 1,
                      }}
                    >
                      <View
                        style={{
                          width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                          borderColor: isSelected ? colors.primary : isFull ? colors.danger : colors.border,
                          justifyContent: 'center', alignItems: 'center', marginEnd: spacing.md,
                        }}
                      >
                        {isSelected && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[textPresets.body, isFull && { color: colors.textTertiary }]}>{alt.day} - {alt.date}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.sm }}>
                          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.borderLight, overflow: 'hidden' }}>
                            <View style={{ width: `${(alt.slots / alt.total) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: isFull ? colors.danger : colors.primary }} />
                          </View>
                          <Text style={[textPresets.caption, isFull && { color: colors.danger }]}>
                            {isFull ? t('attendance.absent') : `${alt.slots}/${alt.total}`}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                <TextInput
                  value={rescheduleReason}
                  onChangeText={setRescheduleReason}
                  placeholder={t('session.reason')}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={3}
                  style={{
                    fontFamily: fonts.regular, fontSize: 14,
                    backgroundColor: colors.background, borderRadius: radius.md,
                    padding: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg,
                    color: colors.textPrimary, textAlign: 'right',
                    minHeight: 80, borderWidth: 1, borderColor: colors.border,
                  }}
                />

                <TouchableOpacity
                  onPress={() => { if (selectedDate) setRescheduleSent(true); }}
                  disabled={!selectedDate || !rescheduleReason.trim()}
                  activeOpacity={0.85}
                  style={{ borderRadius: radius.md, overflow: 'hidden', opacity: (!selectedDate || !rescheduleReason.trim()) ? 0.5 : 1 }}
                >
                  <LinearGradient colors={['#06B6D4', '#0891B2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>{t('session.reschedule_request')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={activeModal === 'report'} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setActiveModal(null); setReportText(''); }} />
          <View
            style={{
              backgroundColor: colors.white,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              padding: spacing.xxl,
              paddingBottom: spacing.xl5,
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xl }} />
            <Text style={textPresets.h2}>{t('attendance.report_title')}</Text>
            <Text style={[textPresets.bodySmall, { marginBottom: spacing.lg }]}>
              {t('session.course')}: الرياضيات
            </Text>

            <TextInput
              value={reportText}
              onChangeText={setReportText}
              placeholder={t('attendance.report_placeholder')}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={4}
              style={{
                fontFamily: fonts.regular,
                fontSize: 14,
                backgroundColor: colors.background,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginBottom: spacing.lg,
                color: colors.textPrimary,
                textAlign: 'right',
                minHeight: 100,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />

            <TouchableOpacity
              onPress={() => { setActiveModal(null); setReportText(''); }}
              disabled={!reportText.trim()}
              activeOpacity={0.85}
              style={{ borderRadius: radius.md, overflow: 'hidden', opacity: !reportText.trim() ? 0.5 : 1 }}
            >
              <LinearGradient colors={gradients.warm} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>
                  {t('attendance.report_submit')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
