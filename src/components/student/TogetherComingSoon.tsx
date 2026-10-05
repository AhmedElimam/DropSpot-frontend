import type { ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, nav, gradients } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';

/**
 * «سوا» — the student's centre tab before group chat and threads open (founder 2026-10-06:
 * «a coming-soon design with a blurred background that shows group chats and threads»).
 *
 * Behind a frosted pane sits a preview of what is coming — a course room with classmates and
 * the teacher, and a teacher's question with answers and votes. The blur is drawn, not
 * computed: the preview is laid down five times, each copy nudged a little and faint, which
 * reads as out of focus. A live blur view would be a native module and continuous compositing
 * work on mid-range Android (the heat problem of 2026-09-22); this costs one static layout.
 *
 * The threads branch renders this same component while neither feature flag is on, so the
 * tab never sits empty.
 */
export function TogetherComingSoon() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* The preview, out of focus. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <SoftFocus>
          <Preview topInset={insets.top} />
        </SoftFocus>
        {/* The frosted pane: the page colour, mostly opaque, deeper towards the bottom. */}
        <LinearGradient
          colors={[`${colors.background}9E`, `${colors.background}C7`, `${colors.background}EB`]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg, paddingTop: insets.top + spacing.xl, paddingBottom: nav.bottomHeight + insets.bottom + spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, ...shadows.md }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <BrandMark size={34} tint={colors.brand} />
            </View>
            <View style={{ marginTop: spacing.md, backgroundColor: colors.accentLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.accentText }}>{t('together.soon')}</Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 30, color: colors.textPrimary, marginTop: spacing.sm }}>{t('together.title')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>{t('together.tagline')}</Text>
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            <Feature icon="chat" title={t('together.chat_title')} body={t('together.chat_body')} />
            <Feature icon="threads" title={t('together.threads_title')} body={t('together.threads_body')} />
          </View>

          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 20, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xl }}>
            {t('together.footnote')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Feature({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
      <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary, marginTop: 2 }}>{body}</Text>
      </View>
    </View>
  );
}

/** Five faint, slightly shifted copies of the same layout: an out-of-focus look with no native blur. */
const NUDGES: readonly (readonly [number, number, number])[] = [
  [0, 0, 0.34], [2.5, 0, 0.2], [-2.5, 0, 0.2], [0, 2.5, 0.2], [0, -2.5, 0.2],
];

export function SoftFocus({ children }: { children: ReactNode }) {
  return (
    <>
      {NUDGES.map(([x, y, o], i) => (
        <View key={i} style={[StyleSheet.absoluteFill, { opacity: o, transform: [{ translateX: x }, { translateY: y }] }]}>
          {children}
        </View>
      ))}
    </>
  );
}

/** What the tab will hold: a course room and a teacher's question. Illustrative, from i18n. */
function Preview({ topInset }: { topInset: number }) {
  const { t } = useTranslation();
  const bubble = (mine: boolean, who: string, text: string) => (
    <View style={{ alignSelf: mine ? 'flex-start' : 'flex-end', maxWidth: '78%', backgroundColor: mine ? colors.brand : colors.surface, borderRadius: 18, borderWidth: mine ? 0 : 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
      {!mine ? <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{who}</Text> : null}
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: mine ? colors.onPrimary : colors.textPrimary }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: topInset + spacing.xl, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.onHero }}>{t('together.preview_room')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.onHeroSoft, marginTop: 2 }}>{t('together.preview_room_sub')}</Text>
      </LinearGradient>

      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        {bubble(false, t('together.preview_teacher'), t('together.preview_msg_1'))}
        {bubble(false, t('together.preview_student_a'), t('together.preview_msg_2'))}
        {bubble(true, '', t('together.preview_msg_3'))}

        <View style={{ marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon name="threads" size={18} color={colors.accent} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accent }}>{t('together.preview_thread_label')}</Text>
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, marginTop: spacing.xs }}>{t('together.preview_thread_q')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('together.preview_thread_answers')}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>{t('together.preview_thread_votes')}</Text>
          </View>
        </View>

        {bubble(false, t('together.preview_student_b'), t('together.preview_msg_4'))}
      </View>
    </View>
  );
}
