import { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import client from '@/api/client';
import { getApiBaseOverride } from '@/api/apiBase';
import { colors, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';

export type MapPoint = { lat: number; lng: number; label?: string };
export type MapDriver = MapPoint & { busy?: boolean; online?: boolean };
export type MapShop = MapPoint & { id: number; price?: string };

/** The site the API lives on — the map script and the referrer Google checks the key against. */
export function apiOrigin(): string {
  const base = getApiBaseOverride() ?? client.defaults.baseURL ?? 'https://drosspot.app/api/v1';
  return base.replace(/\/api\/v\d+\/?$/, '');
}

/**
 * The phone's own position, live (founder 2026-10-14: «live location like Talabat»). Watches
 * while the screen that asked is mounted; null until the first fix or without permission.
 */
export function useMyLocation(enabled = true): { me: MapPoint | null; denied: boolean } {
  const [me, setMe] = useState<MapPoint | null>(null);
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let gone = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (gone) return;
      if (status !== 'granted') { setDenied(true); return; }
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      if (last && !gone) setMe({ lat: last.coords.latitude, lng: last.coords.longitude });
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 8 }, (pos) => {
        if (!gone) setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    })();
    return () => { gone = true; sub?.remove(); };
  }, [enabled]);
  return { me, denied };
}

/**
 * The marketplace map, navy night (founder 2026-10-14). The drawing lives in ONE file on the
 * server (public/js/drosmap.js — styled Google Maps with the brand pins, OpenStreetMap when
 * there is no key), shared with the shop's portal; this component hosts it in a WebView and
 * pushes the points in. The page loads once; every update is injected.
 *
 * `showMe` adds the phone's own live blue dot and a «موقعي» button. `picker` turns it into
 * Talabat's «حدد موقعك»: a fixed pin in the middle, the map moves under it, and `onCenter` /
 * `onAddress` report where it rests.
 */
export function LiveMap({ mapsKey, shop, dest, driver, drivers, me, teacher, trail, shops, onShop, selectedShop, follow, showMe, picker, start, onCenter, onAddress, onMoving, centerTo, height = 220, style, rounded = true, controlsBottom = 12, padBottom = 0 }: {
  mapsKey?: string | null;
  shop?: MapPoint | null; dest?: MapPoint | null; driver?: MapDriver | null; drivers?: MapDriver[];
  me?: MapPoint | null; teacher?: MapPoint | null; trail?: [number, number][];
  shops?: MapShop[]; onShop?: (id: number) => void; selectedShop?: number | null;
  /** Keep this point in view as it moves (the driver's dot). */
  follow?: MapPoint | null;
  showMe?: boolean;
  picker?: boolean;
  /** Where the picker opens. */
  start?: MapPoint | null;
  onCenter?: (p: MapPoint) => void;
  onAddress?: (p: MapPoint & { text: string | null }) => void;
  onMoving?: () => void;
  /** Move the map here now (change `nonce` to move again to the same point). */
  centerTo?: (MapPoint & { nonce: number }) | null;
  height?: number | `${number}%`; style?: StyleProp<ViewStyle>;
  rounded?: boolean;
  controlsBottom?: number;
  /** How much of the map a sheet covers from the bottom — frames and centres above it. */
  padBottom?: number;
}) {
  const ref = useRef<WebView>(null);
  const origin = useMemo(apiOrigin, []);
  const live = useMyLocation(!!showMe || !!picker);
  const mine = me ?? (showMe || picker ? live.me : null);
  const startAt = useRef<MapPoint | null>(start ?? null);
  const centred = useRef(false);

  const html = useMemo(() => `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#m{margin:0;height:100%;background:#0E1433}</style>
<script src="${origin}/js/drosmap.js"></script></head>
<body><div id="m"></div><script>
window.__map = window.DrosMap ? DrosMap.create(document.getElementById('m'), { key: ${JSON.stringify(mapsKey ?? '')}, picker: ${picker ? 'true' : 'false'}, padBottom: ${Math.max(0, Math.round(padBottom))} }) : null;
window.__set = function (s) { if (window.__map) window.__map.set(s); };
window.__select = function (id) { if (window.__map) window.__map.select(id); };
window.__center = function (lat, lng, z) { if (window.__map) window.__map.center(lat, lng, z); };
</script></body></html>`, [origin, mapsKey, picker, padBottom]);

  const allDrivers = [...(drivers ?? []), ...(driver ? [driver] : [])];
  const route = allDrivers[0] && dest ? [[allDrivers[0].lat, allDrivers[0].lng], [dest.lat, dest.lng]] : null;
  const state = JSON.stringify({ shop: shop ?? null, dest: dest ?? null, drivers: allDrivers, me: mine, teacher: teacher ?? null, trail: trail ?? [], route, shops: shops ?? [], follow: follow ?? null });
  const inject = (js: string) => ref.current?.injectJavaScript(`${js}; true;`);
  const push = () => inject(`window.__set && window.__set(${state})`);
  useEffect(push, [state]);
  useEffect(() => { if (selectedShop != null) inject(`window.__select && window.__select(${Number(selectedShop)})`); }, [selectedShop]);

  // The picker opens where it was told, else on the phone's first fix.
  const centreOn = (p: MapPoint, z = 17) => inject(`window.__center && window.__center(${p.lat}, ${p.lng}, ${z})`);
  useEffect(() => {
    if (!picker || centred.current) return;
    const p = startAt.current ?? live.me;
    if (p) { centreOn(p); centred.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker, live.me]);

  useEffect(() => { if (centerTo) { centreOn(centerTo, 17); centred.current = true; } }, [centerTo?.nonce]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'shop' && onShop) onShop(Number(msg.id));
      if (msg?.type === 'center' && onCenter) onCenter({ lat: msg.lat, lng: msg.lng });
      if (msg?.type === 'address' && onAddress) onAddress({ lat: msg.lat, lng: msg.lng, text: msg.text ?? null });
      if (msg?.type === 'moving' && onMoving) onMoving();
    } catch { /* not ours */ }
  };

  return (
    <View style={[{ height, borderRadius: rounded ? radius.lg : 0, overflow: 'hidden', backgroundColor: '#0E1433' }, style]}>
      <WebView ref={ref} source={{ html, baseUrl: origin + '/' }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled
        scrollEnabled={false} nestedScrollEnabled onLoadEnd={() => {
          push();
          if (picker) { const p = startAt.current ?? live.me; if (p) { centreOn(p); centred.current = true; } }
        }} onMessage={onMessage} setSupportMultipleWindows={false}
        style={{ backgroundColor: '#0E1433' }} />
      {(showMe || picker) ? (
        <TouchableOpacity onPress={() => { if (mine) centreOn(mine, picker ? 17 : 16); }} accessibilityRole="button" accessibilityLabel="موقعي" activeOpacity={0.85}
          style={{ position: 'absolute', end: 12, bottom: controlsBottom, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: mine ? 1 : 0.5, ...shadows.md }}>
          <Icon name="gps" size={20} color={mine ? colors.brand : colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
