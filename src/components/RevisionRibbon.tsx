import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { REVISION_INK } from '@/theme/revision';
import { Icon } from '@/components/ui/Icon';
import { useRevisionActive } from '@/hooks/useRevisionTheme';

/**
 * «وضع المراجعة» — the thin status line for screens where the season is not obvious from
 * the hero alone (a form, a list with its own header). Amber on indigo, one line, never a
 * wall. Renders nothing while the season is off, so screens can mount it unconditionally.
 */
export function RevisionRibbon({ style, compact = false }: { style?: StyleProp<ViewStyle>; compact?: boolean }) {
  const { t } = useTranslation();
  const on = useRevisionActive();
  if (!on) return null;
  return (
    <View accessibilityRole="text" style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: compact ? 'flex-start' : 'stretch', backgroundColor: REVISION_INK.indigoDeep, paddingVertical: compact ? 3 : 5, paddingHorizontal: 12, borderRadius: compact ? radius.full : 0, borderBottomWidth: compact ? 0 : 2, borderBottomColor: REVISION_INK.amber }, style]}>
      <Icon name="book" size={12} color={REVISION_INK.amber} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#FFFFFF', letterSpacing: 0.2 }}>{t('revision.ribbon')}</Text>
    </View>
  );
}

/** On a teacher's card for a student or parent: «موسم المراجعة» — the family sees the season, not the theme. */
export function TeacherSeasonChip({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: REVISION_INK.indigo, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }, style]}>
      <Icon name="book" size={11} color={REVISION_INK.amber} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: '#FFFFFF' }}>{t('revision.teacher_season_chip')}</Text>
    </View>
  );
}

/** The small «مراجعة» / «امتحان» chip that revision and exam sessions carry everywhere. */
export function RevisionChip({ kind, style }: { kind: 'revision' | 'exam'; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const exam = kind === 'exam';
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: exam ? colors.accentLight : REVISION_INK.light, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 1.5 }, style]}>
      <Icon name={exam ? 'trophy' : 'book'} size={11} color={exam ? colors.accentText : REVISION_INK.onLight} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: exam ? colors.accentText : REVISION_INK.onLight }}>{t(exam ? 'teacher.exam_badge' : 'revision.chip')}</Text>
    </View>
  );
}
