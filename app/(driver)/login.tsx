import { useState } from 'react';
import { View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from '@/ui/dialog';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Field, Input } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { driverLogin } from '@/api/driver';
import { useDriverStore } from '@/stores/driverStore';

/** «سائق مطبعة»: phone + the 6-digit code the shop handed over. No account, no OTP. */
export default function DriverLogin() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const signIn = useDriverStore((s) => s.signIn);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy || !phone.trim() || code.trim().length < 6) return;
    setBusy(true);
    try {
      const r = await driverLogin(phone.trim(), code.trim());
      await signIn(r.token, r.driver);
      router.replace('/(driver)' as Href);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.message ?? t('driver.login_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.onHeroChip, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="forward" size={20} color={colors.onHero} />
          </TouchableOpacity>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg }}>
            <Icon name="gps" size={32} color={colors.onAccent} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: colors.onHero, marginTop: spacing.md }}>{t('driver.title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.onHeroSoft, marginTop: 4, lineHeight: 21 }}>{t('driver.login_sub')}</Text>
        </LinearGradient>

        <View style={{ padding: spacing.lg }}>
          <Field label={t('driver.phone')} first><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01xxxxxxxxx" textContentType="telephoneNumber" /></Field>
          <Field label={t('driver.code')} hint={t('driver.code_hint')}>
            <Input value={code} onChangeText={(v) => setCode(v.replace(/[^0-9٠-٩]/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="••••••" maxLength={6} center style={{ fontSize: 24, letterSpacing: 8 }} />
          </Field>
          <View style={{ marginTop: spacing.lg }}><Button title={t('driver.enter')} onPress={go} loading={busy} disabled={!phone.trim() || code.length < 6} /></View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, marginTop: spacing.md, lineHeight: 19 }}>{t('driver.login_note')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
