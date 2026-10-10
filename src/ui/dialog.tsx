import { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { create } from 'zustand';
import i18n from '@/i18n';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useRose } from '@/hooks/useRose';
import { BrandMark } from '@/components/ui/BrandMark';
import { RosePortrait } from '@/components/rose/RoseStamp';

/**
 * The app's own popup in place of the system alert (founder 2026-10-10: «I don't like the
 * alert popup … make our own popup with a logo, and on مدام روز's page make it her»).
 *
 * `Alert.alert(title, message, buttons, options)` keeps the system signature, so every
 * screen only changes its import. One host at the root (DialogHost) shows the queue one at
 * a time: the brand emblem over the card — or مدام روز's portrait and her name on her
 * pages, which say so with useDialogPersona('rose') while focused. The safe answer sits
 * first, the act in brand ink, red when it removes something; three or more answers stack.
 */
export type DialogPersona = 'brand' | 'rose';

export interface DialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface Pending {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  /** A tap outside answers with the cancel button (or the only button). */
  cancelable: boolean;
  /** Called when the popup is dismissed by a tap outside (the system alert's option). */
  onDismiss?: () => void;
  persona: DialogPersona;
}

interface DialogState {
  queue: Pending[];
  persona: DialogPersona;
  push: (p: Omit<Pending, 'id' | 'persona'>) => void;
  shift: () => void;
  setPersona: (p: DialogPersona) => void;
}

let seq = 0;

export const useDialogStore = create<DialogState>((set, get) => ({
  queue: [],
  persona: 'brand',
  push: (p) => set((s) => ({ queue: [...s.queue, { ...p, id: ++seq, persona: get().persona }] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
  setPersona: (persona) => set({ persona }),
}));

export const Alert = {
  alert(title: string, message?: string, buttons?: DialogButton[], options?: { cancelable?: boolean; onDismiss?: () => void }): void {
    const list = buttons && buttons.length ? buttons : [{ text: i18n.t('common.ok', { defaultValue: 'حسنًا' }) }];
    const cancelable = options?.cancelable ?? (list.length === 1 || list.some((b) => b.style === 'cancel'));
    useDialogStore.getState().push({ title, message: message || undefined, buttons: list, cancelable, onDismiss: options?.onDismiss });
  },
};

/** Say whose popup this screen gets while it is focused — مدام روز on her pages. */
export function useDialogPersona(persona: DialogPersona): void {
  useFocusEffect(useCallback(() => {
    useDialogStore.getState().setPersona(persona);
    return () => useDialogStore.getState().setPersona('brand');
  }, [persona]));
}

export function DialogHost() {
  const current = useDialogStore((s) => s.queue[0]);
  const shift = useDialogStore((s) => s.shift);
  const rose = useRose();
  const [shown, setShown] = useState<Pending | null>(null);
  const dim = useSharedValue(0);
  const pop = useSharedValue(0.86);

  useEffect(() => {
    if (current) {
      setShown(current);
      dim.value = withTiming(1, { duration: 180 });
      pop.value = 0.86;
      pop.value = withSpring(1, { damping: 14, stiffness: 220 });
    } else if (shown) {
      dim.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.quad) });
      const t = setTimeout(() => setShown(null), 150);
      return () => clearTimeout(t);
    }
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  const backdrop = useAnimatedStyle(() => ({ opacity: dim.value }));
  const card = useAnimatedStyle(() => ({ opacity: dim.value, transform: [{ scale: pop.value }] }));

  if (!shown) return null;
  const s = shown;
  const asRose = s.persona === 'rose' && rose.named;
  const HEAD = asRose ? 92 : 64;
  const cancel = s.buttons.find((b) => b.style === 'cancel') ?? (s.buttons.length === 1 ? s.buttons[0] : null);
  const press = (b: DialogButton) => {
    shift();
    b.onPress?.();
  };
  const onBackdrop = () => {
    if (!s.cancelable) return;
    if (cancel) press(cancel);
    else shift();
    s.onDismiss?.();
  };
  const stacked = s.buttons.length > 2;
  // The safe answer first; in a stack, the acts on top and the way out at the bottom.
  const ordered = stacked
    ? [...s.buttons.filter((b) => b.style !== 'cancel'), ...s.buttons.filter((b) => b.style === 'cancel')]
    : [...s.buttons.filter((b) => b.style === 'cancel'), ...s.buttons.filter((b) => b.style !== 'cancel')];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBackdrop}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,14,39,0.55)' }, backdrop]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdrop} accessibilityLabel="إغلاق" />
      </Animated.View>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
        <Animated.View style={[{ paddingTop: HEAD / 2 }, card]} accessibilityViewIsModal>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, padding: spacing.lg, paddingTop: HEAD / 2 + spacing.sm, ...shadows.md }}>
            {asRose ? <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.accent, textAlign: 'center' }}>{rose.name}</Text> : null}
            <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.textPrimary, textAlign: 'center', marginTop: 4 }}>{s.title}</Text>
            {s.message ? (
              <View style={{ marginTop: spacing.md, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'center' }}>{s.message}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {ordered.map((b, i) => {
                const isCancel = b.style === 'cancel';
                const isDanger = b.style === 'destructive';
                return (
                  <Pressable key={`${i}-${b.text}`} onPress={() => press(b)} accessibilityRole="button"
                    style={({ pressed }) => ({
                      flex: stacked ? undefined : 1, minHeight: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md,
                      backgroundColor: isCancel ? 'transparent' : isDanger ? colors.danger : colors.brand,
                      borderWidth: isCancel ? 1.5 : 0, borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    })}>
                    <Text numberOfLines={2} style={{ fontFamily: fonts.bold, fontSize: 15, color: isCancel ? colors.textSecondary : '#fff', textAlign: 'center' }}>{b.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
            {asRose ? (
              <RosePortrait size={HEAD} />
            ) : (
              <View style={{ width: HEAD, height: HEAD, borderRadius: HEAD / 2, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
                <BrandMark size={32} />
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
