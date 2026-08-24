import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Switch, Alert, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { getPaymentMethods, updatePaymentMethods, type PaymentMethods } from '@/api/paymentMethods';
import { getFriendlyErrorMessage } from '@/utils/errors';

const VODAFONE_RE = /^01[0125]\d{8}$/;

/**
 * Teacher billing settings — Vodafone Cash / InstaPay receiving details shown to
 * parents on invoices. Teacher-only (the API rejects assistants). Informational
 * only; nothing here processes money.
 */
export default function BillingSettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['payment-methods'], queryFn: getPaymentMethods });

  const [form, setForm] = useState<PaymentMethods | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  const save = useMutation({
    mutationFn: (payload: PaymentMethods) => updatePaymentMethods(payload),
    onSuccess: (res) => {
      qc.setQueryData(['payment-methods'], res);
      Alert.alert(t('billing_settings.saved'));
    },
    onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)),
  });

  const set = (patch: Partial<PaymentMethods>) => setForm((f) => (f ? { ...f, ...patch } : f));

  // Validation mirrors the backend: an ENABLED method needs its number (+ name);
  // Vodafone must be a valid Egyptian mobile.
  const vodafoneValid = !form?.vodafone_enabled || (VODAFONE_RE.test(form?.vodafone_number ?? '') && !!form?.vodafone_name?.trim());
  const instapayValid = !form?.instapay_enabled || (!!form?.instapay_number?.trim() && !!form?.instapay_name?.trim());
  const canSave = !!form && vodafoneValid && instapayValid && !save.isPending;

  const submit = () => {
    if (!form || !canSave) return;
    // Cash is forced on when both digital methods are off (backend does this too).
    const physical = form.physical_enabled || (!form.vodafone_enabled && !form.instapay_enabled);
    save.mutate({ ...form, physical_enabled: physical });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceSunken, justifyContent: 'center', alignItems: 'center' }}>
          <Icon name="forward" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('billing_settings.title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{t('billing_settings.subtitle')}</Text>
        </View>
      </View>

      {isLoading || !form ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: nav.bottomHeight + insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.infoLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="info" size={18} color={colors.infoText} outline />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.infoText }}>{t('billing_settings.intro')}</Text>
          </View>

          {/* Vodafone Cash */}
          <View style={card}>
            <View style={rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.danger + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="phone" size={18} color={colors.danger} />
                </View>
                <Text style={sectionTitle}>{t('billing_settings.vodafone')}</Text>
              </View>
              <Switch value={form.vodafone_enabled} onValueChange={(v) => set({ vodafone_enabled: v })} trackColor={{ true: colors.brand }} />
            </View>
            {form.vodafone_enabled ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <TextInput
                  value={form.vodafone_number ?? ''}
                  onChangeText={(v) => set({ vodafone_number: v.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  placeholder={t('billing_settings.number_ph')}
                  placeholderTextColor={colors.textTertiary}
                  style={[input, { textAlign: 'left' }]}
                />
                <TextInput
                  value={form.vodafone_name ?? ''}
                  onChangeText={(v) => set({ vodafone_name: v })}
                  placeholder={t('billing_settings.name_ph')}
                  placeholderTextColor={colors.textTertiary}
                  style={input}
                />
                {!vodafoneValid ? <Text style={errText}>{t('billing_settings.vodafone_invalid')}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* InstaPay */}
          <View style={card}>
            <View style={rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brand + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="card" size={18} color={colors.brand} />
                </View>
                <Text style={sectionTitle}>{t('billing_settings.instapay')}</Text>
              </View>
              <Switch value={form.instapay_enabled} onValueChange={(v) => set({ instapay_enabled: v })} trackColor={{ true: colors.brand }} />
            </View>
            {form.instapay_enabled ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <TextInput
                  value={form.instapay_number ?? ''}
                  onChangeText={(v) => set({ instapay_number: v })}
                  autoCapitalize="none"
                  placeholder={t('billing_settings.instapay_ph')}
                  placeholderTextColor={colors.textTertiary}
                  style={[input, { textAlign: 'left' }]}
                />
                <TextInput
                  value={form.instapay_name ?? ''}
                  onChangeText={(v) => set({ instapay_name: v })}
                  placeholder={t('billing_settings.name_ph')}
                  placeholderTextColor={colors.textTertiary}
                  style={input}
                />
                {!instapayValid ? <Text style={errText}>{t('billing_settings.instapay_invalid')}</Text> : null}
              </View>
            ) : null}
          </View>

          {/* Cash in person */}
          <View style={card}>
            <View style={rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.success + '18', justifyContent: 'center', alignItems: 'center' }}>
                  <Icon name="money" size={18} color={colors.success} />
                </View>
                <Text style={sectionTitle}>{t('billing_settings.physical')}</Text>
              </View>
              <Switch
                value={form.physical_enabled || (!form.vodafone_enabled && !form.instapay_enabled)}
                disabled={!form.vodafone_enabled && !form.instapay_enabled}
                onValueChange={(v) => set({ physical_enabled: v })}
                trackColor={{ true: colors.brand }}
              />
            </View>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>{t('billing_settings.physical_hint')}</Text>
          </View>

          {/* Booking & booklets — teacher-level payment models. Per-course amounts
              (booklet price, down-payment) are set on each course page. */}
          <View style={card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brand + '18', justifyContent: 'center', alignItems: 'center' }}>
                <Icon name="book" size={18} color={colors.brand} />
              </View>
              <Text style={sectionTitle}>{t('billing_settings.booking_title')}</Text>
            </View>

            {/* Booklets master switch */}
            <View style={[rowBetween, { marginTop: spacing.sm }]}>
              <Text style={[settingLabel, { flex: 1, paddingEnd: spacing.md }]}>{t('billing_settings.offers_booklets')}</Text>
              <Switch value={form.offers_booklets} onValueChange={(v) => set({ offers_booklets: v })} trackColor={{ true: colors.brand }} />
            </View>
            <Text style={hint}>{t('billing_settings.offers_booklets_hint')}</Text>

            <View style={divider} />

            {/* Down-payment (دفعة) at booking */}
            <View style={rowBetween}>
              <Text style={[settingLabel, { flex: 1, paddingEnd: spacing.md }]}>{t('billing_settings.requires_down_payment')}</Text>
              <Switch value={form.requires_down_payment} onValueChange={(v) => set({ requires_down_payment: v })} trackColor={{ true: colors.brand }} />
            </View>
            <Text style={hint}>{t('billing_settings.requires_down_payment_hint')}</Text>

            {form.requires_down_payment ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[settingLabel, { marginBottom: spacing.sm }]}>{t('billing_settings.secures_label')}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                  {(['session', 'booklet', 'flat'] as const).map((k) => {
                    const on = form.default_booking_secures === k;
                    return (
                      <TouchableOpacity
                        key={k}
                        onPress={() => set({ default_booking_secures: k })}
                        activeOpacity={0.85}
                        style={{ paddingHorizontal: spacing.md, height: 40, justifyContent: 'center', borderRadius: radius.full, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surfaceSunken }}
                      >
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? colors.brand : colors.textSecondary }}>{t(`billing_settings.secures_${k}`)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={divider} />

            {/* Booklet fee counts as the booking charge */}
            <View style={rowBetween}>
              <Text style={[settingLabel, { flex: 1, paddingEnd: spacing.md }]}>{t('billing_settings.booklet_secures_booking')}</Text>
              <Switch value={form.booklet_secures_booking} onValueChange={(v) => set({ booklet_secures_booking: v })} trackColor={{ true: colors.brand }} />
            </View>
            <Text style={hint}>{t('billing_settings.booklet_secures_booking_hint')}</Text>
          </View>

          <Button title={t('common.save')} onPress={submit} loading={save.isPending} disabled={!canSave} variant="primary" />
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const card = { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md } as const;
const rowBetween = { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } as const;
const sectionTitle = { fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary } as const;
const input = { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };
const errText = { fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText } as const;
const settingLabel = { fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary } as const;
const hint = { fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs } as const;
const divider = { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.md } as const;
