import { useEffect } from 'react';
import { View, Text, AppState, TouchableOpacity, Linking, Platform, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { syncAppConfig } from '@/stores/appConfigSync';
import { useAppConfig } from '@/hooks/useAppConfig';
import { isVersionBelow } from '@/utils/semver';
import { checkForOtaUpdate } from '@/updates/otaUpdates';
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

  useEffect(() => {
    useAppConfigStore.getState().hydrate().finally(() => { void syncAppConfig(); });
    void checkForOtaUpdate();
    lastOtaCheck = Date.now();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s !== 'active') return;
      void syncAppConfig();
      // An OTA check is a manifest fetch and, when one is waiting, a full bundle
      // download. Firing it on EVERY resume meant a teacher who switches apps twenty
      // times during a session paid for twenty of them. A release is not published
      // twenty times an hour, so once every six hours finds it just as fast at a
      // fraction of the radio time (Android heat/battery reports, 2026-09-22).
      if (Date.now() - lastOtaCheck < OTA_CHECK_EVERY_MS) return;
      lastOtaCheck = Date.now();
      void checkForOtaUpdate();
    });
    return () => sub.remove();
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

  // The binary's version (app.json expo.version). With runtimeVersion policy "appVersion"
  // an OTA update only ever reaches the binary it was built for, so an update can never
  // report a version the installed store build doesn't have. The floor arrives per
  // platform (the server resolves it from X-App-Platform), so raising iOS never blocks
  // Android. Re-checked on every foreground: lower the floor and the screen lifts.
  const current = Constants.expoConfig?.version ?? '0.0.0';
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
