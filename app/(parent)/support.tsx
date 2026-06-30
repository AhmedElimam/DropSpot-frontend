import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, textPresets, shadows, gradients, nav } from '@/theme/index';

const MOCK_TEACHERS = [
  { id: 't1', name: 'أحمد علي', subject: 'الرياضيات' },
  { id: 't2', name: 'نورا حسن', subject: 'العلوم' },
  { id: 't3', name: 'محمد سالم', subject: 'اللغة العربية' },
  { id: 't4', name: 'سارة عمر', subject: 'اللغة الإنجليزية' },
  { id: 't5', name: 'خالد يوسف', subject: 'التربية الإسلامية' },
];

const MOCK_TICKETS = [
  { id: '1', subject: 'استفسار عن درجة الاختبار', teacher: 'أحمد علي', status: 'in_progress', date: '2026-06-28', message: 'السلام عليكم، أريد الاستفسار عن درجة ابني في اختبار الرياضيات...', lastUpdate: '2026-06-29' },
  { id: '2', subject: 'تأخر الحصة', teacher: 'نورا حسن', status: 'open', date: '2026-06-27', message: 'تأخرت حصة العلوم يوم الأربعاء الماضي...', lastUpdate: '2026-06-27' },
  { id: '3', subject: 'طلب مذكرة مراجعة', teacher: 'محمد سالم', status: 'resolved', date: '2026-06-25', message: 'هل يمكن توفير مذكرة مراجعة لاختبار اللغة العربية؟', lastUpdate: '2026-06-26' },
];

const statusColors: Record<string, string> = {
  open: colors.warning,
  in_progress: colors.primary,
  resolved: colors.success,
  closed: colors.textTertiary,
};

export default function SupportScreen() {
  const { t } = useTranslation();
  const [showTickets, setShowTickets] = useState(true);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; name: string; subject: string } | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSend = () => {
    setSubject('');
    setMessage('');
    setSelectedTeacher(null);
  };

  const canSend = selectedTeacher && subject.trim() && message.trim();

  const renderStatusBadge = (status: string) => {
    const color = statusColors[status] || colors.textTertiary;
    const label = status === 'open' ? t('support.status_open') : status === 'in_progress' ? t('support.status_in_progress') : status === 'resolved' ? t('support.status_resolved') : t('support.status_closed');
    return (
      <View style={{ backgroundColor: color + '20', paddingVertical: 2, paddingHorizontal: 8, borderRadius: radius.full }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color }}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: nav.bottomHeight }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#8B5CF6', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl4, paddingBottom: spacing.xl4 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.white, letterSpacing: -0.5 }}>
            {t('support.title')}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            {t('support.select_teacher_hint')}
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.lg }}>
          <View style={{ flexDirection: 'row', backgroundColor: colors.borderLight, borderRadius: radius.md, padding: 3 }}>
            <TouchableOpacity
              onPress={() => setShowTickets(true)}
              style={{
                flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md - 2,
                backgroundColor: showTickets ? colors.white : 'transparent', alignItems: 'center',
                ...(showTickets ? shadows.sm : {}),
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: showTickets ? colors.primary : colors.textSecondary }}>
                {t('support.no_tickets') ? 'التذاكر' : 'التذاكر'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowTickets(false)}
              style={{
                flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md - 2,
                backgroundColor: !showTickets ? colors.white : 'transparent', alignItems: 'center',
                ...(!showTickets ? shadows.sm : {}),
              }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: !showTickets ? colors.primary : colors.textSecondary }}>
                {t('support.new_ticket')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
          {showTickets ? (
            MOCK_TICKETS.length === 0 ? (
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl4, alignItems: 'center', ...shadows.md }}>
                <Text style={{ fontSize: 40, marginBottom: spacing.md }}>🎫</Text>
                <Text style={textPresets.bodySmall}>{t('support.no_tickets')}</Text>
              </View>
            ) : (
              MOCK_TICKETS.map((ticket) => (
                <TouchableOpacity key={ticket.id} activeOpacity={0.7} style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm }}>
                    <View style={{ flex: 1, marginEnd: spacing.sm }}>
                      <Text style={textPresets.subtitle} numberOfLines={1}>{ticket.subject}</Text>
                      <Text style={[textPresets.caption, { marginTop: 2 }]}>{t('support.teacher')}: {ticket.teacher}</Text>
                    </View>
                    {renderStatusBadge(ticket.status)}
                  </View>
                  <Text style={[textPresets.bodySmall, { marginBottom: spacing.sm }]} numberOfLines={2}>{ticket.message}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={textPresets.caption}>{t('support.created_at')}: {ticket.date}</Text>
                    <Text style={textPresets.caption}>{t('support.last_update')}: {ticket.lastUpdate}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )
          ) : (
            <>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, ...shadows.md }}>
                <Text style={textPresets.h3}>{t('support.new_ticket')}</Text>

                <TouchableOpacity
                  onPress={() => setShowTeacherPicker(true)}
                  style={{ marginTop: spacing.lg, backgroundColor: colors.borderLight, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: selectedTeacher ? colors.textPrimary : colors.textTertiary }}>
                    {selectedTeacher ? `${selectedTeacher.name} (${selectedTeacher.subject})` : t('support.select_teacher')}
                  </Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{'<'}</Text>
                </TouchableOpacity>

                <TextInput
                  style={{ marginTop: spacing.md, backgroundColor: colors.borderLight, borderRadius: radius.md, padding: spacing.md, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, textAlign: 'right' }}
                  placeholder={t('support.subject_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={subject}
                  onChangeText={setSubject}
                />

                <TextInput
                  style={{ marginTop: spacing.md, backgroundColor: colors.borderLight, borderRadius: radius.md, padding: spacing.md, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary, minHeight: 120, textAlignVertical: 'top', textAlign: 'right' }}
                  placeholder={t('support.message_placeholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                />

                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!canSend}
                  activeOpacity={0.8}
                  style={{ marginTop: spacing.lg }}
                >
                  <LinearGradient
                    colors={canSend ? gradients.primary : ['#CBD5E1', '#CBD5E1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: canSend ? colors.white : colors.textTertiary }}>
                      {t('support.send')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showTeacherPicker} transparent animationType="fade" onRequestClose={() => setShowTeacherPicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setShowTeacherPicker(false)}>
          <View style={{ backgroundColor: colors.white, borderRadius: radius.xl, width: '80%', maxHeight: 350, overflow: 'hidden', ...shadows.lg }}>
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <Text style={[textPresets.h3, { textAlign: 'center' }]}>{t('support.select_teacher')}</Text>
            </View>
            <FlatList
              data={MOCK_TEACHERS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { setSelectedTeacher(item); setShowTeacherPicker(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: selectedTeacher?.id === item.id ? colors.primaryLight : 'transparent' }}
                >
                  <LinearGradient colors={['#8B5CF6', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, color: '#fff' }}>{(item.name || '?')[0]}</Text>
                  </LinearGradient>
                  <View style={{ marginStart: spacing.md, flex: 1 }}>
                    <Text style={[textPresets.body, { fontFamily: fonts.medium }]}>{item.name}</Text>
                    <Text style={textPresets.caption}>{item.subject}</Text>
                  </View>
                  {selectedTeacher?.id === item.id && (
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
