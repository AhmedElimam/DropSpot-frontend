import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { driverJoin } from '@/api/driver';
import { useDriverStore } from '@/stores/driverStore';

/**
 * Where the shop's QR lands (founder 2026-10-14: drivers join by scanning, no driver entry on
 * the login screen). `drosspot://driver-join/<token>` → the one-time token becomes a driver
 * session on this phone → the driver's map. A spent or old QR says so and asks for a new one.
 */
export default function DriverJoin() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const signIn = useDriverStore((s) => s.signIn);
  const [state, setState] = useState<'joining' | 'welcome' | 'failed'>('joining');
  const [name, setName] = useState('');
  const [shop, setShop] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let gone = false;
    (async () => {
      try {
        const r = await driverJoin(String(token ?? ''));
        await signIn(r.token, r.driver);
        if (gone) return;
        setName(r.driver.name); setShop(r.driver.shop.name ?? '');
        setState('welcome');
        setTimeout(() => router.replace('/(driver)' as Href), 1400);
      } catch (e: any) {
        if (gone) return;
        setError(e?.response?.data?.message ?? t('driver.join_failed'));
        setState('failed');
      }
    })();
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
      <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: state === 'failed' ? colors.danger : colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={state === 'failed' ? 'error' : state === 'welcome' ? 'success' : 'gps'} size={42} color={colors.onAccent} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.onHero, marginTop: spacing.lg, textAlign: 'center' }}>
        {state === 'joining' ? t('driver.joining') : state === 'welcome' ? t('driver.welcome', { name }) : t('driver.join_title_failed')}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, color: colors.onHeroSoft, marginTop: spacing.sm, textAlign: 'center', lineHeight: 22 }}>
        {state === 'joining' ? t('driver.joining_sub') : state === 'welcome' ? t('driver.rides_for', { shop }) : error}
      </Text>
      {state === 'failed' ? (
        <View style={{ marginTop: spacing.xl, alignSelf: 'stretch', borderRadius: radius.lg }}>
          <Button title={t('common.back')} variant="outline" onPress={() => router.replace('/resolve' as Href)} />
        </View>
      ) : null}
    </LinearGradient>
  );
}
