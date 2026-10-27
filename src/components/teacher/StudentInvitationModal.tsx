import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

export interface InvitationStudent {
  name: string | null;
  grade?: string | null;
  /** 'card' — a student's card; 'invite' — the QR a parent made in the app for a child with no card yet. */
  via: 'card' | 'invite';
}

/**
 * «دعوة طالب» (founder 2026-10-22): a scan of someone who is not on the teacher's roster is
 * not a failed check-in — it is a student asking to join. One modal for the home scanner
 * and for fast register: who it is, that they are not on the list yet, and one button to
 * enrol them in a group (the enrol screen takes it from there: group, terms, confirm).
 */
export function StudentInvitationModal({ student, busy = false, course, onEnroll, onClose }: {
  student: InvitationStudent | null;
  busy?: boolean;
  /** The group the enrolment goes to, when the screen already knows it (fast register). */
  course?: string | null;
  onEnroll: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={student !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
          {/* The envelope band: it reads as an invitation before a word is read. */}
          <View style={{ backgroundColor: colors.brandTint, alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
            <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
              <Icon name={student?.via === 'invite' ? 'scan' : 'card'} size={38} color={colors.brand} />
              <View style={{ position: 'absolute', bottom: -6, end: -6, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                <Icon name="add" size={16} color={colors.onPrimary} />
              </View>
            </View>
            <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('invitation_modal.badge')}</Text>
            </View>
          </View>

          <View style={{ padding: spacing.lg, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 30, color: colors.textPrimary, textAlign: 'center' }} numberOfLines={2}>
              {student?.name || t('invitation_modal.unnamed')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
              {student?.grade ? (
                <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{student.grade}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.warningLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3 }}>
                <Icon name="warning" size={12} color={colors.warningText} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.warningText }}>{t('invitation_modal.not_on_roster')}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              {t(student?.via === 'invite' ? 'invitation_modal.body_invite' : 'invitation_modal.body_card')}
            </Text>

            <TouchableOpacity onPress={onEnroll} disabled={busy} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginTop: spacing.lg, alignSelf: 'stretch', minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: busy ? 0.7 : 1 }}>
              {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Icon name="add" size={20} color={colors.onPrimary} />}
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }} numberOfLines={1}>
                {course ? t('invitation_modal.enroll_in', { course }) : t('invitation_modal.enroll')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} accessibilityRole="button" style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('invitation_modal.not_now')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
