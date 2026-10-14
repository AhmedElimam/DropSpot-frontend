import { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import client from '@/api/client';
import { getApiBaseOverride } from '@/api/apiBase';
import { colors, radius, shadows } from '@/theme/index';
import { STAGING_KEY, STAGING_HEADER } from '@/config/env';
import { useThemeStore } from '@/stores/themeStore';

/** The page colour under the map while it loads, per theme (drosmap.js paints the same). */
export const MAP_BG = { dark: '#0E1433', light: '#EEF0F4' } as const;
import { Icon } from '@/components/ui/Icon';

export type MapPoint = { lat: number; lng: number; label?: string; logo?: string | null; /** a fixed pin, not a live dot (no pulse) */ static?: boolean };
/** `heading` in degrees from north, when the phone knows it (moving). */
export type MapDriver = MapPoint & { id?: number; busy?: boolean; online?: boolean; vehicle?: string; heading?: number | null };
export type MapShop = MapPoint & { id: number; price?: string };
export type MyPoint = MapPoint & { heading?: number | null };

/** The site the API lives on — the map script and the referrer Google checks the key against. */
export function apiOrigin(): string {
  const base = getApiBaseOverride() ?? client.defaults.baseURL ?? 'https://drosspot.app/api/v1';
  return base.replace(/\/api\/v\d+\/?$/, '');
}

/** The last place this phone was seen at, shared by every map — a new map opens there at once. */
let lastFix: MyPoint | null = null;
export const lastKnownFix = () => lastFix;

/**
 * The phone's own position, live (founder 2026-10-14: «live location like Talabat … get the
 * location right away»). Starts from the last place any map saw this phone, then the OS's
 * last known fix, then one quick reading — so the dot is there at once — and watches while
 * the screen that asked is mounted. Null only before any fix ever, or without permission.
 */
export function useMyLocation(enabled = true): { me: MyPoint | null; denied: boolean } {
  const [me, setMe] = useState<MyPoint | null>(() => (enabled ? lastFix : null));
  const [denied, setDenied] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let sub: Location.LocationSubscription | null = null;
    let gone = false;
    let fresh = false;
    const put = (p: MyPoint, live: boolean) => {
      if (gone || (fresh && !live)) return;
      if (live) fresh = true;
      lastFix = p;
      setMe(p);
    };
    (async () => {
      const cur = await Location.getForegroundPermissionsAsync().catch(() => null);
      const status = cur?.status === 'granted' ? 'granted' : (await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' }))).status;
      if (gone) return;
      if (status !== 'granted') { setDenied(true); return; }
      Location.getLastKnownPositionAsync().then((l) => { if (l) put({ lat: l.coords.latitude, lng: l.coords.longitude }, false); }).catch(() => {});
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((c) => put({ lat: c.coords.latitude, lng: c.coords.longitude }, false)).catch(() => {});
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 5 }, (pos) => {
        put({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: headingOf(pos) }, true);
      });
      if (gone) sub.remove();
    })();
    return () => { gone = true; sub?.remove(); };
  }, [enabled]);
  return { me, denied };
}

/**
 * The server sends drosmap.js as cacheable for a year, so a fixed address kept every phone on
 * the first copy it ever loaded. The address changes every 10 minutes: a map change on the
 * server reaches phones within that, and in between the copy is reused.
 */
function mapVersion(): number {
  return Math.floor(Date.now() / 600_000);
}

/** The direction of travel, only while really moving (a still phone's heading is noise). */
export function headingOf(pos: Location.LocationObject): number | null {
  const h = pos.coords.heading;
  const v = pos.coords.speed;
  return h != null && h >= 0 && v != null && v > 0.8 ? Math.round(h) : null;
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
export function LiveMap({ mapsKey, shop, dest, driver, drivers, me, teacher, trail, shops, onShop, selectedShop, follow, showMe, hideMeDot, hideLocate, picker, start, onCenter, onAddress, onMoving, centerTo, height = 220, style, rounded = true, controlsBottom = 12, padBottom = 0 }: {
  mapsKey?: string | null;
  shop?: MapPoint | null; dest?: MapPoint | null; driver?: MapDriver | null; drivers?: MapDriver[];
  me?: MyPoint | null; teacher?: MapPoint | null; trail?: [number, number][];
  shops?: MapShop[]; onShop?: (id: number) => void; selectedShop?: number | null;
  /** Keep this point in view as it moves (the driver's dot). */
  follow?: MapPoint | null;
  showMe?: boolean;
  /** With `showMe`: keep the «موقعي» button but draw no blue dot (the driver is his own marker). */
  hideMeDot?: boolean;
  /** Draw no «موقعي» button: the screen draws its own (it rides above a sheet). Centre with `centerTo`. */
  hideLocate?: boolean;
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
  // Light mode gets Google's own look, dark mode the navy night (founder 2026-10-14).
  const theme = useThemeStore((st) => st.scheme) === 'dark' ? 'dark' : 'light';
  // Open where things are: the picker's start, else the phone's last place (no «all Egypt» first).
  const startHere = useRef<MapPoint | null>(start ?? lastFix);
  const bg = MAP_BG[theme];
  const live = useMyLocation(!!showMe || !!picker);
  const mine = me ?? (showMe || picker ? live.me : null);
  const startAt = useRef<MapPoint | null>(start ?? null);
  const centred = useRef(false);

  const html = useMemo(() => `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#m{margin:0;height:100%;background:${bg}}</style>
<script src="${origin}/js/drosmap.js?v=${mapVersion()}"></script></head>
<body><div id="m"></div><script>
window.__map = window.DrosMap ? DrosMap.create(document.getElementById('m'), { key: ${JSON.stringify(mapsKey ?? '')}, picker: ${picker ? 'true' : 'false'}, padBottom: ${Math.max(0, Math.round(padBottom))}, theme: '${theme}', start: ${JSON.stringify(startHere.current)}, headers: ${STAGING_KEY ? JSON.stringify({ [STAGING_HEADER]: STAGING_KEY }) : 'null'} }) : null;
window.__set = function (s) { if (window.__map) window.__map.set(s); };
window.__select = function (id) { if (window.__map) window.__map.select(id); };
window.__center = function (lat, lng, z) { if (window.__map) window.__map.center(lat, lng, z); };
</script></body></html>`, [origin, mapsKey, picker, padBottom, theme, bg]);

  const allDrivers = [...(drivers ?? []), ...(driver ? [driver] : [])];
  const route = allDrivers[0] && dest ? [[allDrivers[0].lat, allDrivers[0].lng], [dest.lat, dest.lng]] : null;
  const state = JSON.stringify({ shop: shop ?? null, dest: dest ?? null, drivers: allDrivers, me: hideMeDot ? null : mine, teacher: teacher ?? null, trail: trail ?? [], route, shops: shops ?? [], follow: follow ?? null });
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
    <View style={[{ height, borderRadius: rounded ? radius.lg : 0, overflow: 'hidden', backgroundColor: bg }, style]}>
      <WebView ref={ref} source={{ html, baseUrl: origin + '/' }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled
        scrollEnabled={false} nestedScrollEnabled onLoadEnd={() => {
          push();
          if (picker) { const p = startAt.current ?? live.me; if (p) { centreOn(p); centred.current = true; } }
        }} onMessage={onMessage} setSupportMultipleWindows={false}
        style={{ backgroundColor: bg }} />
      {(showMe || picker) && !hideLocate ? (
        <TouchableOpacity onPress={() => { if (mine) centreOn(mine, picker ? 17 : 16); }} accessibilityRole="button" accessibilityLabel="موقعي" activeOpacity={0.85}
          style={{ position: 'absolute', end: 12, bottom: controlsBottom, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: mine ? 1 : 0.5, ...shadows.md }}>
          <Icon name="gps" size={20} color={mine ? colors.brand : colors.textTertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
