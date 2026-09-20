import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Text, TouchableOpacity, View, StatusBar, ActivityIndicator, type GestureResponderEvent } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

/**
 * A photo, full screen, inside the app.
 *
 * Tapping an image used to hand it to the system share sheet — the only thing that happened
 * was a list of other apps. That is the moment a chat stops feeling like a chat (founder,
 * 2026-09-20: files must be "handled inside the app like WhatsApp"). This is the viewer:
 * black ground, the photo fit to the screen, pinch to zoom, drag to pan, double-tap to
 * toggle, pull down to close. Sharing is still there, one tap away, but it is no longer what
 * a tap DOES.
 *
 * Built on plain `Animated` + `PanResponder`, deliberately not gesture-handler/reanimated:
 * this ships over the air, and a JS bundle must never import a native module the installed
 * binary may not carry. Everything here is in React Native itself.
 */
export function ImageViewer({ visible, url, headers, name, onClose, onShare }: {
  visible: boolean;
  url: string;
  headers: Record<string, string>;
  name: string | null;
  onClose: () => void;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // Gesture bookkeeping lives in a ref: it changes on every frame and must never re-render.
  const g = useRef({ scale: 1, tx: 0, ty: 0, startDist: 0, startScale: 1, startTx: 0, startTy: 0, lastTap: 0, pinched: false });

  const settle = (s: number, x: number, y: number) => {
    g.current.scale = s; g.current.tx = x; g.current.ty = y;
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 7 }),
      Animated.spring(tx, { toValue: x, useNativeDriver: true, friction: 7 }),
      Animated.spring(ty, { toValue: y, useNativeDriver: true, friction: 7 }),
    ]).start();
  };

  useEffect(() => {
    // Every open starts flat. A photo left zoomed in by the last look is a confusing first frame.
    if (visible) { scale.setValue(1); tx.setValue(0); ty.setValue(0); g.current = { ...g.current, scale: 1, tx: 0, ty: 0, startDist: 0 }; setLoaded(false); }
  }, [visible, scale, tx, ty]);

  const dist = (e: GestureResponderEvent) => {
    const [a, b] = e.nativeEvent.touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const now = Date.now();
      const s = g.current;
      s.startTx = s.tx; s.startTy = s.ty; s.startDist = 0; s.pinched = false;
      // Double-tap: in, or back out. 280ms is the OS's own double-tap window, near enough.
      if (e.nativeEvent.touches.length === 1 && now - s.lastTap < 280) {
        s.lastTap = 0;
        if (s.scale > 1.05) settle(1, 0, 0);
        else settle(2.5, 0, 0);
        return;
      }
      s.lastTap = now;
    },
    onPanResponderMove: (e, gs) => {
      const s = g.current;
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        const d = dist(e);
        if (s.startDist === 0) { s.startDist = d; s.startScale = s.scale; return; }
        s.pinched = true;
        const next = Math.max(1, Math.min(4, s.startScale * (d / s.startDist)));
        s.scale = next;
        scale.setValue(next);
        return;
      }
      if (s.scale > 1.02) {
        // Zoomed: one finger pans the photo.
        s.tx = s.startTx + gs.dx; s.ty = s.startTy + gs.dy;
        tx.setValue(s.tx); ty.setValue(s.ty);
      } else {
        // Flat: the photo follows a downward pull, so letting go feels like dropping it.
        ty.setValue(Math.max(0, gs.dy));
      }
    },
    onPanResponderRelease: (_e, gs) => {
      const s = g.current;
      s.startDist = 0;
      if (s.scale <= 1.02) {
        if (!s.pinched && gs.dy > 110 && Math.abs(gs.vy) > 0.2) { onClose(); return; }
        settle(1, 0, 0);
        return;
      }
      // Keep a zoomed photo from being panned entirely off-screen.
      const limit = 160 * (s.scale - 1);
      settle(s.scale, Math.max(-limit, Math.min(limit, s.tx)), Math.max(-limit, Math.min(limit, s.ty)));
    },
    onPanResponderTerminate: () => { g.current.startDist = 0; },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Animated.View
          {...pan.panHandlers}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}
        >
          <Image
            source={{ uri: url, headers }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            transition={120}
            onLoad={() => setLoaded(true)}
            accessibilityLabel={name ?? t('chat.photo')}
          />
        </Animated.View>

        {!loaded ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}

        {/* Chrome sits above the gesture surface and never intercepts a pinch. */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('chat.close')} hitSlop={12}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {onShare ? (
            <TouchableOpacity onPress={onShare} accessibilityRole="button" accessibilityLabel={t('chat.share')} hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <Icon name="download" size={18} color="#fff" outline />
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: '#fff' }}>{t('chat.share')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View pointerEvents="none" style={{ position: 'absolute', bottom: insets.bottom + 14, left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.xl }}>
          {name ? <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{name}</Text> : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{t('chat.zoom_hint')}</Text>
        </View>
      </View>
    </Modal>
  );
}
