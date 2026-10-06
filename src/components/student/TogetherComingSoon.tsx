import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from '@/components/ui/Refreshable';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';

/**
 * «مجموعاتي» — the student's centre tab before group chat and threads open (founder 2026-10-06).
 *
 * v2 (same day, founder: «it doesn't show this is the chat or threads — it's totally blocked by
 * the popup»): no card on top any more. The page IS the preview — a sharp heading for each
 * feature, and under it a recognisable but out-of-focus sample of it (a course room; a
 * teacher's question with answers, votes and the answer video), each sample marked «قريبًا».
 *
 * The blur is drawn, not computed: a sample is laid down once at reduced opacity and four more
 * times faint and nudged, which reads as out of focus. A live blur view would be a native
 * module and continuous compositing on mid-range Android (the heat problem of 2026-09-22).
 *
 * The threads branch renders this same component while neither feature flag is on.
 */
export function TogetherComingSoon() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: gradients.hero[0] }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, backgroundColor: colors.background, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {/* Heading: what the tab is, and that it is on its way. */}
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xl4, paddingHorizontal: spacing.lg, alignItems: 'center' }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.onHeroChip, borderWidth: 1, borderColor: colors.onHeroChipBorder, alignItems: 'center', justifyContent: 'center' }}>
            <BrandMark size={30} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.onHero, marginTop: spacing.sm }}>{t('together.title')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.onHeroSoft, marginTop: 2, textAlign: 'center' }}>{t('together.tagline')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 }}>
            <Icon name="clock" size={14} color={colors.onAccent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent }}>{t('together.soon')}</Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -spacing.xl, gap: spacing.xl }}>
          <ComingSoonSection icon="chat" title={t('together.chat_title')} body={t('together.chat_body')}>
            <ChatSample />
          </ComingSoonSection>
          <ComingSoonSection icon="threads" title={t('together.threads_title')} body={t('together.threads_body')}>
            <ThreadSample />
          </ComingSoonSection>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 20, color: colors.textTertiary, textAlign: 'center' }}>{t('together.footnote')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** A feature: its name and one line in sharp text, then its sample out of focus, marked «قريبًا». */
export function ComingSoonSection({ icon, title, body, children }: { icon: IconName; title: string; body: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadows.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={21} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 16.5, color: colors.textPrimary }}>{title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, marginTop: 2 }}>{body}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.borderLight }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <SoftFocus>{children}</SoftFocus>
        {/* A light frost, thicker at the foot, and the mark that it is not open yet. */}
        <LinearGradient
          colors={[`${colors.background}00`, `${colors.background}59`, `${colors.background}D9`]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={{ position: 'absolute', bottom: spacing.md, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 5, ...shadows.sm }}>
          <Icon name="lock" size={13} color={colors.textSecondary} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textSecondary }}>{t('together.soon')}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * Out of focus: the sample once at reduced opacity (it sizes the box), and four faint copies
 * nudged around it. Recognisable shapes, soft text.
 */
const NUDGES: readonly (readonly [number, number])[] = [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]];

export function SoftFocus({ children }: { children: ReactNode }) {
  return (
    <View>
      <View style={{ opacity: 0.5 }}>{children}</View>
      {NUDGES.map(([x, y], i) => (
        <View key={i} style={[StyleSheet.absoluteFill, { opacity: 0.16, transform: [{ translateX: x }, { translateY: y }] }]}>
          {children}
        </View>
      ))}
    </View>
  );
}

/** A course room: its header, then a few messages from the teacher and classmates. Illustrative. */
function ChatSample() {
  const { t } = useTranslation();
  const bubble = (mine: boolean, who: string, text: string) => (
    <View style={{ alignSelf: mine ? 'flex-start' : 'flex-end', maxWidth: '80%', backgroundColor: mine ? colors.brand : colors.surface, borderRadius: 16, borderWidth: mine ? 0 : 1, borderColor: colors.border, paddingVertical: 7, paddingHorizontal: spacing.md }}>
      {!mine ? <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.brand }}>{who}</Text> : null}
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: mine ? colors.onPrimary : colors.textPrimary }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ padding: spacing.md, paddingBottom: spacing.xl4, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="book" size={15} color={colors.brand} />
        </View>
        <View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }}>{t('together.preview_room')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{t('together.preview_room_sub')}</Text>
        </View>
      </View>
      {bubble(false, t('together.preview_teacher'), t('together.preview_msg_1'))}
      {bubble(false, t('together.preview_student_a'), t('together.preview_msg_2'))}
      {bubble(true, '', t('together.preview_msg_3'))}
    </View>
  );
}

/** A teacher's question: the question, two answers with votes, and the answer video. Illustrative. */
function ThreadSample() {
  const { t } = useTranslation();
  const answer = (who: string, text: string, votes: string, best: boolean) => (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: best ? colors.success : colors.border, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.textSecondary }}>{who}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textPrimary }} numberOfLines={1}>{text}</Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Icon name="thumbUp" size={15} color={best ? colors.success : colors.textTertiary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: best ? colors.success : colors.textTertiary }}>{votes}</Text>
      </View>
    </View>
  );
  return (
    <View style={{ padding: spacing.md, paddingBottom: spacing.xl4, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="question" size={15} color={colors.accent} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accent }}>{t('together.preview_thread_label')}</Text>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('together.preview_thread_q')}</Text>
      {answer(t('together.preview_student_a'), t('together.preview_answer_1'), '٢٤', true)}
      {answer(t('together.preview_student_b'), t('together.preview_answer_2'), '٧', false)}
      <View style={{ height: 70, borderRadius: radius.lg, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play" size={16} color={colors.onPrimary} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{t('together.preview_video')}</Text>
      </View>
    </View>
  );
}
