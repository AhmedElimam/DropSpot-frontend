import { useEffect, useMemo, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import client from '@/api/client';
import { getApiBaseOverride } from '@/api/apiBase';
import { colors, radius } from '@/theme/index';

export type MapPoint = { lat: number; lng: number; label?: string };
export type MapDriver = MapPoint & { busy?: boolean; online?: boolean };
export type MapShop = MapPoint & { id: number; price?: string };

/** The site the API lives on — the map script and the referrer Google checks the key against. */
export function apiOrigin(): string {
  const base = getApiBaseOverride() ?? client.defaults.baseURL ?? 'https://drosspot.app/api/v1';
  return base.replace(/\/api\/v\d+\/?$/, '');
}

/**
 * The marketplace map, in DrosSpot's own style. The drawing lives in ONE file on the server
 * (public/js/drosmap.js — styled Google Maps with the brand pins, OpenStreetMap when there is
 * no key), shared with the shop's portal; this component only hosts it in a WebView and
 * pushes the points in. The page loads once; every update is injected, so a moving dot never
 * reloads the map. The WebView's base URL is the API's site, so a key restricted to that
 * site works.
 */
export function LiveMap({ mapsKey, shop, dest, driver, drivers, me, teacher, trail, shops, onShop, selectedShop, follow, height = 220, style }: {
  mapsKey?: string | null;
  shop?: MapPoint | null; dest?: MapPoint | null; driver?: MapDriver | null; drivers?: MapDriver[];
  me?: MapPoint | null; teacher?: MapPoint | null; trail?: [number, number][];
  shops?: MapShop[]; onShop?: (id: number) => void; selectedShop?: number | null;
  /** Keep this point in view as it moves (the driver's dot). */
  follow?: MapPoint | null;
  height?: number | `${number}%`; style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<WebView>(null);
  const origin = useMemo(apiOrigin, []);
  const html = useMemo(() => `<!doctype html><html dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body,#m{margin:0;height:100%;background:#F7F5EE}</style>
<script src="${origin}/js/drosmap.js"></script></head>
<body><div id="m"></div><script>
window.__map = window.DrosMap ? DrosMap.create(document.getElementById('m'), { key: ${JSON.stringify(mapsKey ?? '')} }) : null;
window.__set = function (s) { if (window.__map) window.__map.set(s); };
window.__select = function (id) { if (window.__map) window.__map.select(id); };
</script></body></html>`, [origin, mapsKey]);

  const allDrivers = [...(drivers ?? []), ...(driver ? [driver] : [])];
  const route = allDrivers[0] && dest ? [[allDrivers[0].lat, allDrivers[0].lng], [dest.lat, dest.lng]] : null;
  const state = JSON.stringify({ shop: shop ?? null, dest: dest ?? null, drivers: allDrivers, me: me ?? null, teacher: teacher ?? null, trail: trail ?? [], route, shops: shops ?? [], follow: follow ?? null });
  const push = () => ref.current?.injectJavaScript(`window.__set && window.__set(${state}); true;`);
  useEffect(push, [state]);
  useEffect(() => { if (selectedShop != null) ref.current?.injectJavaScript(`window.__select && window.__select(${Number(selectedShop)}); true;`); }, [selectedShop]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg?.type === 'shop' && onShop) onShop(Number(msg.id));
    } catch { /* not ours */ }
  };

  return (
    <View style={[{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunken }, style]}>
      <WebView ref={ref} source={{ html, baseUrl: origin + '/' }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled
        scrollEnabled={false} nestedScrollEnabled onLoadEnd={push} onMessage={onMessage} setSupportMultipleWindows={false}
        style={{ backgroundColor: '#F7F5EE' }} />
    </View>
  );
}
