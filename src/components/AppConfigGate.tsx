import { useEffect } from 'react';
import { View, Text, AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useAppConfigStore } from '@/stores/appConfigStore';
import { syncAppConfig } from '@/stores/appConfigSync';
import { useAppConfig } from '@/hooks/useAppConfig';
import { isVersionBelow } from '@/utils/semver';
import { checkForOtaUpdate } from '@/updates/otaUpdates';

/**
 * Owns backend-driven config on the client: hydrate the last-good cache, fetch
 * /app-config on cold start and every app foreground (silent no-op on failure),
 * and enforce min_supported_app_version with a BLOCKING update screen (§4.4).
 * The gate is client-side only — a bad server value can hide UI but never bricks
 * the app, because the comparison runs against the shipped binary version.
 */
export function AppConfigGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const min = useAppConfig().min_supported_app_version;

  useEffect(() => {
    useAppConfigStore.getState().hydrate().finally(() => { void syncAppConfig(); });
    void checkForOtaUpdate();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') { void syncAppConfig(); void checkForOtaUpdate(); }
    });
    return () => sub.remove();
  }, []);

  const current = Constants.expoConfig?.version ?? '0.0.0';
  if (isVersionBelow(current, min)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
        <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: colors.brandTint, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl }}>
          <Icon name="reports" size={44} color={colors.brand} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 22, color: colors.textPrimary, textAlign: 'center' }}>{t('update.required_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>{t('update.required_body')}</Text>
      </View>
    );
  }

  return <>{children}</>;
}
