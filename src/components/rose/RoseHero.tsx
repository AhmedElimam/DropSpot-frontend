import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { formatNumber } from '@/utils/format';
import { useRose } from '@/hooks/useRose';
import { RosePortrait } from './RoseStamp';

/**
 * The top of مدام روز's desk, as in her story videos (founder 2026-10-07: «her frame
 * character takes the upper section and looks bigger, like the video»): deep navy in both
 * schemes, her framed portrait large and centred — the Dros Spot crown on its rim — breathing
 * gently, her name under it, and a speech bubble pointing up at her with what she says now:
 * the greeting (typed out, as in the video), the week or the season, and «ورقة النهارده».
 *
 * A teacher who switched her name off gets the same navy band with the bubble only — no
 * portrait, the generic title — so nothing on the screen speaks as her.
 */
const ON = '#FFFFFF';
const ON_SOFT = 'rgba(255,255,255,0.72)';
const CHIP = 'rgba(255,255,255,0.12)';
const CHIP_BORDER = 'rgba(255,255,255,0.22)';
const GOLD_GLOW = 'rgba(232,190,104,0.16)';

const PORTRAIT = 172;

export function RoseHero({
  greeting, sub, sheet, onBack, onSettings, children,
}: {
  greeting: string;
  sub: string;
  /** «ورقة النهارده» lines; empty = no sheet block. */
  sheet: string[];
  onBack: () => void;
  onSettings?: () => void;
  /** Cards under the bubble (viewing a past period, a load error). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const rose = useRose();
  const [open, setOpen] = useState(false);
  const typed = useTyped(greeting);

  // A slow breath: she floats a few points up and back, forever, so the desk feels occupied.
  const float = useSharedValue(0);
  useEffect(() => {
    float.value = withRepeat(withSequence(
      withTiming(-5, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
    ), -1, false);
  }, [float]);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));

  const square = (icon: 'forward' | 'settings', onPress: () => void, label: string) => (
    <TouchableOpacity onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: CHIP, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={icon === 'forward' ? 22 : 20} color={ON} outline={icon === 'settings'} />
    </TouchableOpacity>
  );

  return (
    <LinearGradient colors={[...gradients.auth]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {square('forward', onBack, t('common.back'))}
        {onSettings ? square('settings', onSettings, t('cash.settings_title')) : <View style={{ width: 40 }} />}
      </View>

      {rose.named ? (
        <View style={{ alignItems: 'center', marginTop: -spacing.lg }}>
          {/* The glow behind the frame, as on the video's navy. */}
          <View style={{ position: 'absolute', top: 6, width: PORTRAIT + 36, height: PORTRAIT + 36, borderRadius: (PORTRAIT + 36) / 2, backgroundColor: GOLD_GLOW }} />
          <Animated.View style={floatStyle}>
            <RosePortrait size={PORTRAIT} large />
          </Animated.View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: ON, marginTop: spacing.xs }}>{rose.name}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: ON_SOFT }}>{t('cash.screen_title')}</Text>
        </View>
      ) : (
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: ON, textAlign: 'center', marginTop: -spacing.xl }}>{rose.name}</Text>
      )}

      {/* Her speech bubble, pointing up at her. */}
      <View style={{ marginTop: spacing.md }}>
        <View style={{ alignSelf: 'center', width: 0, height: 0, borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 11, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.surface }} />
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, ...shadows.md }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.brand, minHeight: 28 }}>{typed}</Text>
          {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{sub}</Text> : null}
          {/* «ورقة النهارده»: the day as she wrote it. Three lines by default; the rest on a tap. */}
          {sheet.length > 0 ? (
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Icon name="calendar" size={15} color={colors.accent} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{t('cash.sheet_title')}</Text>
              </View>
              {(open ? sheet : sheet.slice(0, 3)).map((line, i) => (
                <Text key={i} style={{ fontFamily: i === 0 ? fonts.bold : fonts.regular, fontSize: 13.5, lineHeight: 22, color: i === 0 ? colors.textPrimary : colors.textSecondary }}>{line}</Text>
              ))}
              {sheet.length > 3 ? (
                <TouchableOpacity onPress={() => setOpen((o) => !o)} hitSlop={6} style={{ alignSelf: 'flex-start', marginTop: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.brand }}>{open ? t('cash.sheet_less') : t('cash.sheet_more', { count: formatNumber(sheet.length) })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {children}
    </LinearGradient>
  );
}

/** A card on her navy band (past period, load error): white on a translucent chip. */
export function RoseHeroCard({ icon, title, sub, onPress, chevron = false }: { icon: 'calendar' | 'refresh'; title: string; sub?: string; onPress: () => void; chevron?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button"
      style={{ backgroundColor: CHIP, borderRadius: radius.xl, borderWidth: 1, borderColor: CHIP_BORDER, padding: spacing.lg, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name={icon} size={22} color={ON} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: ON }}>{title}</Text>
        {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: ON_SOFT, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {chevron ? <Icon name="back" size={18} color={ON} /> : null}
    </TouchableOpacity>
  );
}

/** Her greeting typed out once, as in the videos (~28 ms a letter); a new text starts over. */
function useTyped(text: string): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const id = setInterval(() => setN((k) => {
      if (k >= text.length) { clearInterval(id); return k; }
      return k + 1;
    }), 28);
    return () => clearInterval(id);
  }, [text]);
  return text.slice(0, n);
}
