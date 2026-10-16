import { Switch, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePathname, type Href } from 'expo-router';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { REVISION_INK } from '@/theme/revision';
import { Icon } from '@/components/ui/Icon';
import { useReviseMode, useSetReviseMode } from '@/hooks/useReviseMode';
import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Entering / leaving «وضع المراجعة» (founder 2026-10-16): a short confirmation, the server's
 * answer, and then the curtain (RevisionThemeSync sees the new value and crosses over). The
 * screen that flipped it is remembered so the rebuilt tree comes back to it. One hook for the
 * Home hero pill and the Settings row, so both ask the same question.
 */
export function useRevisionToggle(): { on: boolean; known: boolean; pending: boolean; toggle: (to?: boolean) => void } {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data: reviseOn } = useReviseMode();
  const setRevise = useSetReviseMode();
  const toggle = (to?: boolean) => {
    const next = to ?? reviseOn !== true;
    Alert.alert(
      t(next ? 'revision.confirm_on_title' : 'revision.confirm_off_title'),
      t(next ? 'revision.confirm_on_body' : 'revision.confirm_off_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(next ? 'revision.confirm_on_cta' : 'revision.confirm_off_cta'),
          onPress: () => {
            useThemeStore.getState().rememberReturn(pathname && pathname !== '/' ? (pathname as Href) : null);
            setRevise.mutate(next, { onError: () => Alert.alert(t('common.error'), t('revision.switch_failed')) });
          },
        },
      ],
    );
  };
  return { on: reviseOn === true, known: reviseOn !== undefined, pending: setRevise.isPending, toggle };
}

/**
 * The season pill on the Home hero: the switch itself, where the teacher starts the day. Off:
 * a quiet glass chip «وضع المراجعة · اضغط للتفعيل». On: amber, with the knob across. The
 * toggle drawing is ours (no native Switch) so it sits on the hero in both schemes.
 */
export function RevisionModePill({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const { on, known, pending, toggle } = useRevisionToggle();
  const active = useRevisionActive();
  const lit = on || active;
  return (
    <TouchableOpacity onPress={() => toggle()} disabled={!known || pending} activeOpacity={0.85} accessibilityRole="switch" accessibilityState={{ checked: lit, disabled: !known || pending }}
      accessibilityLabel={t('revision.ribbon')} accessibilityHint={t(lit ? 'revision.pill_hint_on' : 'revision.pill_hint_off')}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center', minHeight: 40, paddingStart: 8, paddingEnd: 12, borderRadius: radius.full, backgroundColor: lit ? REVISION_INK.amber : colors.onHeroChip, borderWidth: 1, borderColor: lit ? REVISION_INK.amber : colors.onHeroChipBorder, opacity: known ? 1 : 0.6 }, style]}>
      {/* The knob track: left when off, right (the start side in RTL) when on. */}
      <View style={{ width: 34, height: 20, borderRadius: 10, backgroundColor: lit ? 'rgba(255,255,255,0.35)' : colors.onHeroChipBorder, justifyContent: 'center', paddingHorizontal: 2 }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: lit ? '#FFFFFF' : colors.onHeroSoft, alignSelf: lit ? 'flex-start' : 'flex-end' }} />
      </View>
      <Icon name="book" size={15} color={lit ? '#FFFFFF' : colors.onHero} />
      <View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: lit ? '#FFFFFF' : colors.onHero }}>{t(lit ? 'revision.pill_on' : 'revision.pill_off')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 13, color: lit ? 'rgba(255,255,255,0.85)' : colors.onHeroSoft }}>{t(lit ? 'revision.pill_hint_on' : 'revision.pill_hint_off')}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * The Settings row's switch. Its own component on purpose: `useRevisionToggle` follows the
 * route (usePathname), and called from the Settings screen it re-rendered the whole page on
 * every tab switch (measured 2026-10-16).
 */
export function RevisionSettingsSwitch() {
  const revise = useRevisionToggle();
  return (
    <Switch
      value={revise.on}
      onValueChange={(v) => revise.toggle(v)}
      disabled={revise.pending || !revise.known}
      trackColor={{ true: REVISION_INK.amber, false: colors.border }}
      thumbColor={colors.white}
    />
  );
}
