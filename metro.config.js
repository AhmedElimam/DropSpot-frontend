const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Bundle budget (perf-budget.json): react-native-qrcode-svg's SVG-logo path imports
// react-native-svg/css, which drags in a CSS parser the app never uses. See src/shims/svgCssStub.js.
const svgCssStub = path.join(__dirname, 'src/shims/svgCssStub.js');
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-svg/css' && context.originModulePath.includes(`${path.sep}react-native-qrcode-svg${path.sep}`)) {
    return { type: 'sourceFile', filePath: svgCssStub };
  }
  return resolveRequest ? resolveRequest(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
