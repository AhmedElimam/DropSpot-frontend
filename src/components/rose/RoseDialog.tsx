import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useRose } from '@/hooks/useRose';
import { RosePortrait } from './RoseStamp';

/**
 * مدام روز asks (founder 2026-10-08: «any confirmation popup on her page — Madam Rose asks in
 * a popup»). In place of the system alert on her desk: her portrait over a card, her name, the
 * question in her bubble, and the two answers — the safe one first, the act in brand ink, or in
 * red when it removes something. `tell` is the one-button form for what she reports back.
 *
 * Render `dialog` once in the screen's tree — INSIDE a sheet's content when asking from a sheet,
 * so the popup stacks over it. A teacher who switched her name off gets the same card without
 * the portrait, under «المساعدة الشخصية».
 */
export interface RoseAsk {
  title: string;
  message?: string;
  confirm: string;
  cancel?: string;
  danger?: boolean;
}

export function useRoseDialog(): { ask: (a: RoseAsk) => Promise<boolean>; tell: (title: string, message?: string) => Promise<void>; dialog: ReactNode } {
  const [state, setState] = useState<(RoseAsk & { single: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const ask = useCallback((a: RoseAsk) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setState({ ...a, single: false });
  }), []);
  const tell = useCallback((title: string, message?: string) => new Promise<void>((resolve) => {
    resolver.current = () => resolve();
    setState({ title, message, confirm: 'تمام', single: true });
  }), []);
  const answer = useCallback((v: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    r?.(v);
  }, []);

  return { ask, tell, dialog: <RoseDialog state={state} onAnswer={answer} /> };
}

function RoseDialog({ state, onAnswer }: { state: (RoseAsk & { single: boolean }) | null; onAnswer: (v: boolean) => void }) {
  const rose = useRose();
  const [shown, setShown] = useState<typeof state>(null);
  const dim = useSharedValue(0);
  const pop = useSharedValue(0.86);
  useEffect(() => {
    if (state) {
      setShown(state);
      dim.value = withTiming(1, { duration: 180 });
      pop.value = 0.86;
      pop.value = withSpring(1, { damping: 14, stiffness: 220 });
    } else if (shown) {
      dim.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) });
      const t = setTimeout(() => setShown(null), 150);
      return () => clearTimeout(t);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));
  const card = useAnimatedStyle(() => ({ opacity: dim.value, transform: [{ scale: pop.value }] }));
  if (!shown) return null;
  const s = shown;
  const PORTRAIT = 92;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => onAnswer(false)}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,14,39,0.55)' }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => onAnswer(false)} accessibilityLabel="إغلاق" />
      </Animated.View>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <Animated.View style={[{ paddingTop: rose.named ? PORTRAIT / 2 : 0 }, card]}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, paddingTop: rose.named ? PORTRAIT / 2 + spacing.sm : spacing.lg, ...shadows.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accent, textAlign: 'center' }}>{rose.name}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.textPrimary, textAlign: 'center', marginTop: 4 }}>{s.title}</Text>
            {s.message ? (
              <View style={{ marginTop: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{s.message}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {!s.single ? (
                <Pressable onPress={() => onAnswer(false)} accessibilityRole="button"
                  style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary }}>{s.cancel ?? 'رجوع'}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => onAnswer(true)} accessibilityRole="button"
                style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.lg, backgroundColor: s.danger ? colors.danger : colors.brand, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{s.confirm}</Text>
              </Pressable>
            </View>
          </View>
          {rose.named ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
              <RosePortrait size={PORTRAIT} />
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}
