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
import { RoseLive } from './RoseLive';
import type { RoseSheet } from '@/api/cash';

/**
 * The top of مدام روز's desk, as in her story videos (founder 2026-10-07: «her frame
 * character takes the upper section and looks bigger, like the video»): deep navy in both
 * schemes, her framed portrait large and centred — the Dros Spot crown on its rim — breathing
 * gently and alive (RoseLive: eyes, blinks, lips, hoops, reactions), her name under it, and a speech bubble pointing up at her with what she says now:
 * the greeting (typed out, as in the video), the week or the season, and «ورقة النهارده».
 *
 * A teacher who switched her name off gets the same navy band with the bubble only — no
 * portrait, the generic title — so nothing on the screen speaks as her.
 */
const ON = '#FFFFFF';
const ON_SOFT = 'rgba(255,255,255,0.72)';
const CHIP = 'rgba(255,255,255,0.12)';
const CHIP_BORDER = 'rgba(255,255,255,0.22)';

// A little smaller than the first cut (founder 2026-10-07), still the band's centre.
const PORTRAIT = 148;

export function RoseHero({
  greeting, sub, sheet, onBack, onSettings, children,
}: {
  greeting: string;
  sub: string;
  /** «ورقة النهارده»; null / nothing to say = no sheet block. */
  sheet: RoseSheet | null;
  onBack: () => void;
  onSettings?: () => void;
  /** Cards under the bubble (viewing a past period, a load error). */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const rose = useRose();
  const [open, setOpen] = useState(false);
  const typed = useTyped(greeting);
  const talking = typed.length < greeting.length;

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
          {/* No halo behind her (founder 2026-10-07): the frame sits straight on the navy. */}
          <Animated.View style={floatStyle}>
            <RoseLive size={PORTRAIT} talking={talking} />
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
          {/* Centred (founder 2026-10-07). The untyped rest is drawn transparent, so the line
              keeps its full width while it types and the centred text never shifts. */}
          <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.brand, minHeight: 28, textAlign: 'center' }}>
            {typed}<Text style={{ color: 'transparent' }}>{greeting.slice(typed.length)}</Text>
          </Text>
          {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2, textAlign: 'center' }}>{sub}</Text> : null}
          {sheet && sheet.lines.length > 0 ? <SheetList sheet={sheet} open={open} onToggle={() => setOpen((o) => !o)} /> : null}
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

const FACT = (): Record<string, { icon: 'warning' | 'success' | 'money' | 'note' | 'eye'; tint: string }> => ({
  dues: { icon: 'warning', tint: colors.danger },
  dues_clear: { icon: 'success', tint: colors.success },
  collected: { icon: 'money', tint: colors.success },
  complaints: { icon: 'note', tint: colors.accent },
  review: { icon: 'eye', tint: colors.brand },
});

/**
 * «ورقة النهارده», listed (founder 2026-10-08: «make it listed and organised»): her opening
 * line, then one row per session — the time in its own pill, what and which grade, where,
 * and attendance once it has ended — then each fact on its own row with its icon. Three
 * sessions show; the rest on a tap. An older server sends only `lines`: those, one per row.
 */
function SheetList({ sheet, open, onToggle }: { sheet: RoseSheet; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const sessions = sheet.sessions;
  const right = { textAlign: 'right' as const };

  return (
    <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="calendar" size={16} color={colors.accent} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{t('cash.sheet_title')}</Text>
      </View>
      {sheet.head ? <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2, ...right }}>{sheet.head}</Text> : null}

      {sessions ? (
        <>
          {(open ? sessions : sessions.slice(0, 3)).map((x, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
              <View style={{ minWidth: 62, paddingHorizontal: 8, height: 28, borderRadius: radius.md, backgroundColor: colors.brand + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }} numberOfLines={1}>{x.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 20, color: colors.textPrimary, ...right }}>{x.title}</Text>
                {x.venue ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Icon name="location" size={12} color={colors.textTertiary} />
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{x.venue}</Text>
                  </View>
                ) : null}
                {x.exam || x.present !== null ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {x.exam ? <Pill text={t('cash.sheet_exam')} tint={colors.info} /> : null}
                    {x.present !== null ? <Pill text={t('cash.sheet_present', { n: formatNumber(x.present) })} tint={colors.success} /> : null}
                    {x.absent !== null && x.absent > 0 ? <Pill text={t('cash.sheet_absent', { n: formatNumber(x.absent) })} tint={colors.danger} /> : null}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {sessions.length > 3 ? (
            <TouchableOpacity onPress={onToggle} hitSlop={6} style={{ alignSelf: 'center', marginTop: spacing.sm }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{open ? t('cash.sheet_less') : t('cash.sheet_more', { count: formatNumber(sessions.length) })}</Text>
            </TouchableOpacity>
          ) : null}
          {(sheet.facts ?? []).length > 0 ? (
            <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
              {(sheet.facts ?? []).map((f, i) => {
                const look = FACT()[f.kind] ?? { icon: 'note' as const, tint: colors.textSecondary };
                return (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: look.tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={look.icon} size={15} color={look.tint} />
                    </View>
                    <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textPrimary, ...right }}>{f.text}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
        </>
      ) : (
        sheet.lines.map((line, i) => (
          <Text key={i} style={{ fontFamily: i === 0 ? fonts.bold : fonts.regular, fontSize: 13.5, lineHeight: 22, color: colors.textSecondary, ...right }}>{line}</Text>
        ))
      )}
    </View>
  );
}

function Pill({ text, tint }: { text: string; tint: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: tint + '1A' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tint }}>{text}</Text>
    </View>
  );
}
