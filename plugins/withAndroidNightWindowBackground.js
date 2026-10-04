const { withAndroidColorsNight, AndroidConfig } = require('expo/config-plugins');

/**
 * Give the Android window a NIGHT background colour.
 *
 * The app follows the phone (userInterfaceStyle 'automatic'). The splash already has a night
 * colour (expo-splash-screen writes it), but the window behind the app — `activityBackground`,
 * from the top-level `backgroundColor` — exists only in `values/colors.xml`. On a dark phone
 * the launch went navy splash → light window → navy app: a light flash behind the logo while
 * JS boots (founder 2026-10-04). This writes the same colour name into
 * `values-night/colors.xml`, so the window is navy too and the launch is one colour throughout.
 */
const withAndroidNightWindowBackground = (config, { color }) =>
  withAndroidColorsNight(config, (cfg) => {
    cfg.modResults = AndroidConfig.Colors.assignColorValue(cfg.modResults, {
      name: 'activityBackground',
      value: color,
    });
    return cfg;
  });

module.exports = withAndroidNightWindowBackground;
