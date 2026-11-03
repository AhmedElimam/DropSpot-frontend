// react-native-qrcode-svg imports `LocalSvg` from react-native-svg/css only to draw an SVG LOGO
// inside a QR code — which this app never asks for. That one import pulled the whole CSS/XML
// parser stack (css-tree, css-select, entities, mdn-data: ~180 KB of the Android bundle).
// metro.config.js points that import, from that package only, here. Rendering a logo SVG
// would now draw nothing instead of crashing; plain QR codes are unaffected.
export const LocalSvg = () => null;
