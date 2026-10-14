import { useEffect, useMemo, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '@/theme/index';

export type MapPoint = { lat: number; lng: number };

/**
 * A live map without a native map SDK or an API key: Leaflet on OpenStreetMap tiles inside
 * a WebView. Pins for the shop and the destination, a moving dot for the driver, the trail
 * behind it. Updates are pushed in with injectJavaScript, so the page never reloads while
 * the dot moves.
 */
export function LiveMap({ shop, dest, driver, trail, me, height = 220, style }: {
  shop?: MapPoint | null; dest?: MapPoint | null; driver?: MapPoint | null; trail?: [number, number][]; me?: MapPoint | null;
  height?: number; style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<WebView>(null);
  const html = useMemo(() => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{margin:0;height:100%;background:#EEE9DD}.leaflet-control-attribution{display:none}.dot{width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 6px rgba(201,162,39,.25)}</style></head>
<body><div id="m"></div><script>
var map=L.map('m',{zoomControl:false,attributionControl:false}).setView([30.05,31.24],6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var layer=L.layerGroup().addTo(map),first=true;
function icon(c){return L.divIcon({className:'',html:'<div class="dot" style="background:'+c+'"></div>',iconSize:[18,18],iconAnchor:[9,9]});}
window.paint=function(s){layer.clearLayers();var pts=[];
 if(s.shop){L.marker([s.shop.lat,s.shop.lng],{icon:icon('#0A0E27')}).addTo(layer);pts.push([s.shop.lat,s.shop.lng]);}
 if(s.dest){L.marker([s.dest.lat,s.dest.lng],{icon:icon('#34419B')}).addTo(layer);pts.push([s.dest.lat,s.dest.lng]);}
 if(s.trail&&s.trail.length>1)L.polyline(s.trail,{color:'#34419B',weight:3,opacity:.6}).addTo(layer);
 if(s.driver){L.marker([s.driver.lat,s.driver.lng],{icon:icon('#C9A227'),zIndexOffset:1000}).addTo(layer);pts.push([s.driver.lat,s.driver.lng]);}
 if(s.me){L.circleMarker([s.me.lat,s.me.lng],{radius:7,color:'#fff',fillColor:'#1F9366',fillOpacity:1,weight:2}).addTo(layer);pts.push([s.me.lat,s.me.lng]);}
 if(first&&pts.length){if(pts.length>1)map.fitBounds(pts,{padding:[30,30],maxZoom:16});else map.setView(pts[0],15);first=false;}
 else if(s.driver&&!map.getBounds().contains([s.driver.lat,s.driver.lng]))map.panTo([s.driver.lat,s.driver.lng]);
};
</script></body></html>`, []);

  const state = JSON.stringify({ shop: shop ?? null, dest: dest ?? null, driver: driver ?? null, trail: trail ?? [], me: me ?? null });
  useEffect(() => { ref.current?.injectJavaScript(`window.paint && window.paint(${state}); true;`); }, [state]);

  return (
    <View style={[{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceSunken }, style]}>
      <WebView ref={ref} source={{ html }} originWhitelist={['*']} javaScriptEnabled scrollEnabled={false}
        onLoadEnd={() => ref.current?.injectJavaScript(`window.paint && window.paint(${state}); true;`)} />
    </View>
  );
}
