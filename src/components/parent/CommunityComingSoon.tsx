import { View, Text } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { ComingSoonSection } from '@/components/student/TogetherComingSoon';

/**
 * «مجتمعنا» — the parent's centre tab before the community opens (founder 2026-10-06: «like
 * the student side — the child's course chat, and a parents' chat per course — just the
 * blurred screen and that it is coming soon»). Same language as the student's «مجموعاتي»: a
 * sharp heading per feature and an out-of-focus sample of it, marked «قريبًا».
 */
export function CommunityComingSoon() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.background, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl4, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
            <BrandMark size={30} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: colors.onHero, marginTop: spacing.sm, textAlign: 'center' }}>{t('community.title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 22, color: colors.onHeroSoft, marginTop: 2, textAlign: 'center' }}>{t('community.tagline')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 }}>
            <Icon name="clock" size={14} color={colors.onAccent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent }}>{t('together.soon')}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl, gap: spacing.xl }}>
          <ComingSoonSection icon="kids" title={t('community.child_room_title')} body={t('community.child_room_body')}>
            <ChildRoomSample />
          </ComingSoonSection>
          <ComingSoonSection icon="chat" title={t('community.parents_room_title')} body={t('community.parents_room_body')}>
            <ParentsRoomSample />
          </ComingSoonSection>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 20, color: colors.textTertiary, textAlign: 'center' }}>{t('community.footnote')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** A room's header: what it is and who is in it. */
function RoomHead({ icon, title, sub, tag }: { icon: 'book' | 'children'; title: string; sub: string; tag?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={15} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{sub}</Text>
      </View>
      {tag ? (
        <View style={{ backgroundColor: colors.accentWarmTint, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accentWarm }}>{tag}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Bubble({ who, text, highlight = false }: { who: string; text: string; highlight?: boolean }) {
  return (
    <View style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: highlight ? colors.brandTint : colors.surface, borderRadius: 16, borderWidth: 1, borderColor: highlight ? colors.brand + '44' : colors.border, paddingVertical: 7, paddingHorizontal: spacing.md }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{who}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.textPrimary }}>{text}</Text>
    </View>
  );
}

/** The child's course room, as the parent will follow it. Illustrative. */
function ChildRoomSample() {
  const { t } = useTranslation();
  return (
    <View style={{ padding: spacing.md, paddingBottom: spacing.xl4, gap: spacing.sm }}>
      <RoomHead icon="book" title={t('community.preview_room')} sub={t('community.preview_room_sub')} tag={t('community.preview_child_tag')} />
      <Bubble who={t('community.preview_teacher')} text={t('community.preview_child_msg_1')} highlight />
      <Bubble who={t('community.preview_student_b')} text={t('community.preview_child_msg_2')} />
      <Bubble who={t('community.preview_teacher')} text={t('community.preview_child_msg_3')} highlight />
    </View>
  );
}

/** The parents' room of a course: a pinned note from the teacher, then parents talking. Illustrative. */
function ParentsRoomSample() {
  const { t } = useTranslation();
  return (
    <View style={{ padding: spacing.md, paddingBottom: spacing.xl4, gap: spacing.sm }}>
      <RoomHead icon="children" title={t('community.preview_parents_room')} sub={t('community.preview_parents_sub')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accentWarmTint, borderRadius: radius.lg, padding: spacing.sm }}>
        <Icon name="star" size={15} color={colors.accentWarm} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.accentWarm }}>{t('community.preview_pinned')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }}>{t('community.preview_pinned_msg')}</Text>
        </View>
      </View>
      <Bubble who={t('community.preview_parent_a')} text={t('community.preview_parents_msg_1')} />
      <Bubble who={t('community.preview_parent_b')} text={t('community.preview_parents_msg_2')} />
    </View>
  );
}
