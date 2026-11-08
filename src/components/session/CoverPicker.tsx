import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import type { CoverOption, CoveredIn } from '@/api/teacherSessions';

// «تعويض»: an 'excused' row the server says was covered in another group's session.
export const COVER_COLOR = () => colors.brand;
export const coveredOf = (a: { status: string; covered_in?: CoveredIn | null }): CoveredIn | null =>
  a.status === 'excused' && a.covered_in ? a.covered_in : null;

/**
 * The student sheet's «بيعوّض في حصة تانية»: the teacher's other groups of this grade within a
 * week, nearest first — the one the student was already recorded at comes first, marked «حضر هناك».
 */
export function CoverPicker({ studentId, coveredIn, options, open, busy, onToggle, onPick, showToggle = true }: {
  studentId: number; coveredIn: CoveredIn | null; options: CoverOption[]; open: boolean; busy: boolean;
  onToggle: () => void; onPick: (targetId: number) => void;
  /** The home swipe sheet opens the list from its own «عوّض» button. */
  showToggle?: boolean;
}) {
  const { t } = useTranslation();
  const c = COVER_COLOR();
  const sorted = [...options].sort((a, b) => Number(b.attended_student_ids.includes(studentId)) - Number(a.attended_student_ids.includes(studentId)));
  return (
    <View style={{ marginTop: showToggle ? -spacing.sm : spacing.sm, marginBottom: showToggle ? spacing.lg : 0, gap: spacing.sm }}>
      {coveredIn && showToggle ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: c + '14', borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
          <Icon name="transfer" size={16} color={c} />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: c }}>{t('covering.covered_in', { where: coveredIn.label ?? '—' })}</Text>
        </View>
      ) : null}
      {showToggle ? (
        <TouchableOpacity onPress={onToggle} disabled={busy} accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: open ? c : c + '12', borderWidth: open ? 0 : 1, borderColor: c + '55' }}>
          {busy ? <ActivityIndicator color={open ? '#fff' : c} /> : <Icon name="transfer" size={20} color={open ? '#fff' : c} />}
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: open ? '#fff' : c }}>{t(coveredIn ? 'covering.change' : 'covering.mark')}</Text>
        </TouchableOpacity>
      ) : null}
      {open ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary }}>{t('covering.pick_hint')}</Text>
          {sorted.map((o) => {
            const went = o.attended_student_ids.includes(studentId);
            const chosen = coveredIn?.session_id === String(o.id);
            return (
              <TouchableOpacity key={o.id} onPress={() => onPick(o.id)} disabled={busy || chosen} accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: chosen ? c + '14' : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: chosen ? c : colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 52 }}>
                <Icon name="calendar" size={16} color={chosen ? c : colors.textTertiary} />
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 20, color: colors.textPrimary }}>{o.label}</Text>
                {went ? (
                  <View style={{ backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: 2, paddingHorizontal: 8 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onPrimary }}>{t('covering.attended_there')}</Text>
                  </View>
                ) : null}
                {chosen ? <Icon name="success" size={18} color={c} /> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
