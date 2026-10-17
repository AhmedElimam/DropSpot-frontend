import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePathname, type Href } from 'expo-router';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, radius } from '@/theme/index';
import { REVISION_INK } from '@/theme/revision';
import { Icon } from '@/components/ui/Icon';
import { useReviseMode, useSetReviseMode } from '@/hooks/useReviseMode';
import { useRevisionActive } from '@/hooks/useRevisionTheme';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Entering / leaving «وضع المراجعة» (founder 2026-10-16): a short confirmation, the server's
 * answer, and then the curtain (RevisionThemeSync sees the new value and crosses over). The
 * screen that flipped it is remembered so the rebuilt tree comes back to it. One hook for the
 * Home top-bar chip and the Settings row, so both ask the same question.
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
 * The season's switch on Home, in the top bar beside the logo — the same spot whether the
 * season is on or off (founder 2026-10-17: «I don't like the positioning of revision mode»;
 * the first cut was a big pill wedged between the connection line and the day's numbers).
 * Off: a quiet glass chip «وضع المراجعة». On: amber, «موسم المراجعة» — tap to end it, after
 * the same short confirmation. An assistant sees the season (the chip, not tappable) but never
 * the switch (assistants never see a control they cannot use).
 */
export function SeasonSwitchChip({ canSwitch }: { canSwitch: boolean }) {
  const { t } = useTranslation();
  const { on, known, pending, toggle } = useRevisionToggle();
  const active = useRevisionActive();
  const lit = on || active;
  if (!canSwitch && !lit) return null;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 11, borderRadius: radius.full, backgroundColor: lit ? REVISION_INK.amber : colors.onHeroChip, borderWidth: 1, borderColor: lit ? 'rgba(255,255,255,0.28)' : colors.onHeroChipBorder, opacity: known || lit ? 1 : 0.6 }}>
      <Icon name="book" size={14} color={lit ? '#FFFFFF' : colors.onHero} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: lit ? '#FFFFFF' : colors.onHero }} numberOfLines={1}>{t(lit ? 'revision.season' : 'revision.pill_off')}</Text>
      {/* A switch's knob, small: the chip says it toggles. */}
      {canSwitch ? (
        <View style={{ width: 24, height: 14, borderRadius: 7, backgroundColor: lit ? 'rgba(255,255,255,0.38)' : colors.onHeroChipBorder, justifyContent: 'center', paddingHorizontal: 2 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: lit ? '#FFFFFF' : colors.onHeroSoft, alignSelf: lit ? 'flex-start' : 'flex-end' }} />
        </View>
      ) : null}
    </View>
  );
  if (!canSwitch) return <View accessibilityRole="text" accessibilityLabel={t('revision.season')}>{body}</View>;
  return (
    <TouchableOpacity onPress={() => toggle()} disabled={!known || pending} activeOpacity={0.85} hitSlop={6} accessibilityRole="switch" accessibilityState={{ checked: lit, disabled: !known || pending }}
      accessibilityLabel={t('revision.ribbon')} accessibilityHint={t(lit ? 'revision.pill_hint_on' : 'revision.pill_hint_off')} style={{ flexShrink: 1 }}>
      {body}
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
