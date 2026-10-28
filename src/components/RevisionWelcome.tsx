import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { REVISION_INK } from '@/theme/revision';
import { Icon, type IconName } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { SeasonCrest } from '@/components/SeasonCrest';
import { RosePortrait } from '@/components/rose/RoseStamp';
import { useRose } from '@/hooks/useRose';
import { useThemeStore } from '@/stores/themeStore';
import { usePopupSlot } from '@/ui/popupSlot';

/**
 * «وضع المراجعة مفعّل الآن» (founder 2026-10-17: «when we activate revision mode, show a popup
 * that revision mode is active now and a description of revision mode»). Rises when the
 * entering curtain falls — the crest that just assembled itself on the curtain sits finished at
 * its top — and says, in five lines, what changed: the colours, the countdown, the tools, her
 * look, and that nothing of the usual day went anywhere (and where the switch is to end it).
 * Facts only. Never at launch, never on the way out (themeStore `welcome`). Mounted once, at the
 * root, outside the re-keyed tree, like the curtain.
 */
export function RevisionWelcome() {
  const open = useThemeStore((s) => s.welcome);
  // One popup at a time: the rebuilt app may have its own (مدام روز's unlock) waiting; two iOS
  // modals presented together leave one invisible over the screen and the app freezes.
  const show = usePopupSlot('revision_welcome', open);
  if (!show) return null;
  return <Welcome />;
}

function Welcome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const rose = useRose();
  const close = () => useThemeStore.getState().dismissWelcome();
  const rows: { key: string; icon?: IconName; title: string; body: string }[] = [
    { key: 'colours', icon: 'book', title: t('revision.welcome_colours'), body: t('revision.welcome_colours_body') },
    { key: 'countdown', icon: 'trophy', title: t('revision.welcome_countdown'), body: t('revision.welcome_countdown_body') },
    { key: 'tools', icon: 'scan', title: t('revision.welcome_tools'), body: t('revision.welcome_tools_body') },
    ...(rose.named ? [{ key: 'rose', title: t('revision.welcome_rose'), body: t('revision.welcome_rose_body') }] : []),
    { key: 'usual', icon: 'home', title: t('revision.welcome_usual'), body: t('revision.welcome_usual_body') },
  ];
  return (
    <SheetModal visible onClose={close} handle={false} style={{ backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg, overflow: 'hidden' }}>
      {/* The head: the season's indigo with the finished crest — the curtain's, at rest. */}
      <LinearGradient colors={['#2E3990', REVISION_INK.indigoDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', marginBottom: spacing.sm }} />
        <SeasonCrest size={132} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 30, color: '#FFFFFF', marginTop: spacing.sm, textAlign: 'center' }}>{t('revision.welcome_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.76)', textAlign: 'center', paddingHorizontal: spacing.xl }}>{t('revision.welcome_sub')}</Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
        {rows.map((r) => (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {r.key === 'rose' ? <RosePortrait size={38} nod={false} /> : (
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: REVISION_INK.amber + '24', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={r.icon ?? 'book'} size={19} color={REVISION_INK.amberDeep} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: colors.textPrimary }}>{r.title}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textSecondary }}>{r.body}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={close} activeOpacity={0.88} accessibilityRole="button" style={{ marginTop: spacing.md }}>
          <LinearGradient colors={[REVISION_INK.amberGlow, REVISION_INK.amberDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Icon name="book" size={18} color="#FFFFFF" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#FFFFFF' }}>{t('revision.welcome_cta')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}
