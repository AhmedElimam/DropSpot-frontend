import { useEffect } from 'react';
import { View, Text, AppState, TouchableOpacity, Linking, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, setThemeOverrides } from '@/theme/index';
import { useThemeStore } from '@/stores/themeStore';
import { Icon } from '@/components/ui/Icon';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { syncAppConfig, syncAppConfigOnForeground, watchSessionForConfig } from '@/stores/appConfigSync';
import { useAppConfig } from '@/hooks/useAppConfig';
import { isVersionBelow } from '@/utils/semver';
import { binaryVersion } from '@/utils/binaryVersion';
import { checkForOtaUpdate, reloadIfReady } from '@/updates/otaUpdates';
import { reportCapabilities } from '@/capabilities';
import { storeLinksFor } from '@/utils/storeLinks';

/**
 * Owns backend-driven config on the client: hydrate the last-good cache, fetch
 * /app-config on cold start and every app foreground (silent no-op on failure),
 * and enforce min_supported_app_version with a BLOCKING update screen (§4.4).
 * The gate is client-side only — a bad server value can hide UI but never bricks
 * the app, because the comparison runs against the shipped binary version.
 */
const OTA_CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
let lastOtaCheck = 0;

/** Open the first link the device accepts: the store app, else the web listing. */
async function openFirst(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // This one was refused (no store app, scheme blocked) — try the next.
    }
  }
}

export function AppConfigGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const cfg = useAppConfig();
  const min = cfg.min_supported_app_version;
  const migration = cfg.migration;

  // Colours the backend repaints (config/mobile_ui.php → theme): applied to the live tokens,
  // then the root rebuilds its tree on the new palette — only when something really changed.
  const theme = useAppConfigStore((s) => s.config.ui?.theme);
  useEffect(() => {
    if (setThemeOverrides(theme)) useThemeStore.getState().repainted();
  }, [theme]);

  useEffect(() => {
    useAppConfigStore.getState().hydrate().finally(() => { void syncAppConfig(); void reportCapabilities(); });
    // Flags are per person (feature-targeting, 2026-10-15): sign-in, sign-out and session
    // switches refetch them — and a sign-out resets them first (src/stores/appConfigSync.ts).
    const unwatchSession = watchSessionForConfig();
    void checkForOtaUpdate();
    lastOtaCheck = Date.now();
    let wentBackgroundAt = 0;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s !== 'active') { if (!wentBackgroundAt) wentBackgroundAt = Date.now(); return; }
      const away = wentBackgroundAt ? Date.now() - wentBackgroundAt : 0;
      wentBackgroundAt = 0;
      // A fix downloaded earlier is applied now, if the person was really away — a restart
      // on return from a two-minute absence interrupts nothing (src/updates/otaUpdates.ts).
      void reloadIfReady(away).then((reloaded) => { if (reloaded) return; });
      // Per-user flags on every return, coalesced to once a minute (a beta the super-admin
      // just opened shows up without a relaunch; founder 2026-10-09: «light on all devices»).
      void syncAppConfigOnForeground();
      // An OTA check is a manifest fetch and, when one is waiting, a full bundle
      // download. Firing it on EVERY resume meant a teacher who switches apps twenty
      // times during a session paid for twenty of them. A release is not published
      // twenty times an hour, so once every six hours finds it just as fast at a
      // fraction of the radio time (Android heat/battery reports, 2026-09-22).
      if (Date.now() - lastOtaCheck < OTA_CHECK_EVERY_MS) return;
      lastOtaCheck = Date.now();
      void checkForOtaUpdate();
    });
    return () => { sub.remove(); unwatchSession(); };
  }, []);

  // This app identity has been retired: its store listing is no longer one we can
  // publish to. Show where the app actually lives now, with a button — the plain
  // update screen below would send the user back to the very listing we left.
  if (migration?.retired) {
    const storeUrl = Platform.OS === 'ios'
      ? (migration.ios_url ?? migration.android_url)
      : (migration.android_url ?? migration.ios_url);

    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl }}>
          <Icon name="download" size={44} color={colors.brand} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' }}>{migration.title}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{migration.body}</Text>
        {storeUrl ? (
          <TouchableOpacity
            onPress={() => { void Linking.openURL(storeUrl); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{ marginTop: spacing.xl, minHeight: 50, alignSelf: 'stretch', borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('update.open_new_app')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  // The installed store build's version, read natively — never the OTA manifest's, which
  // says whatever app.json said when the update was published (utils/binaryVersion). The
  // floor arrives per platform (the server resolves it from X-App-Platform), so raising iOS
  // never blocks Android. Re-checked on every foreground: lower the floor and the screen lifts.
  const current = binaryVersion();
  if (isVersionBelow(current, min)) {
    const links = storeLinksFor(Platform.OS, cfg.store, Constants.expoConfig?.android?.package ?? 'com.drosspot.app');
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl }}>
          <Icon name="download" size={44} color={colors.brand} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' }}>{t('update.required_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{t('update.required_body')}</Text>
        {links.length > 0 ? (
          <TouchableOpacity
            onPress={() => { void openFirst(links); }}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={{ marginTop: spacing.xl, minHeight: 50, alignSelf: 'stretch', flexDirection: 'row', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
          >
            <Icon name="download" size={18} color="#fff" />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t(Platform.OS === 'ios' ? 'update.open_app_store' : 'update.open_play_store')}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.md }}>{t('update.current_version', { version: current })}</Text>
      </View>
    );
  }

  return <>{children}</>;
}
