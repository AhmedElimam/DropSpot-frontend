import { SheetModal } from '@/components/ui/SheetModal';
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Alert } from '@/ui/dialog';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useSubmitPaymentProof } from '@/hooks/useInvoices';
import type { Invoice } from '@/api/invoices';
import { formatEGP } from '@/utils/currency';
import { formatNumber } from '@/utils/format';

/**
 * TEMP/INTERIM (Paymob blocked): parent submits an InstaPay / Vodafone Cash
 * transfer screenshot against an outstanding invoice. Distinct from the in-person
 * cash scan-to-confirm flow — this is a remote transfer verified by a proof image
 * the teacher reviews. Requires expo-image-picker (native module → needs a dev build).
 */
export function PaymentProofButton({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const submit = useSubmitPaymentProof();
  const due = invoice.remaining ?? invoice.amount;

  const reset = () => {
    setImageUri(null);
    submit.reset();
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('', t('invoices.permission_needed'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const onSubmit = () => {
    if (!imageUri) return;
    submit.mutate(
      { invoiceId: invoice.id, imageUri },
      {
        onSuccess: () => {
          Alert.alert('', t('invoices.proof_submitted'));
          close();
        },
        onError: (e: any) => Alert.alert('', e?.response?.data?.message || t('invoices.proof_failed')),
      }
    );
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
          backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
        }}
      >
        <Icon name="invoices" size={16} color="#fff" outline />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('invoices.pay_transfer')}</Text>
      </TouchableOpacity>

      <SheetModal visible={open} onClose={close} style={{ backgroundColor: colors.background, padding: 0, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
              {/* What to send, for whom — the number the parent must match in the transfer app. */}
              <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('invoices.pay_transfer')}</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.textPrimary, marginTop: 2 }}>{formatEGP(due)}</Text>
                {[invoice.student_name, invoice.teacher_name ? t('invoices.proof_teacher', { name: invoice.teacher_name }) : null].filter(Boolean).length ? (
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                    {[invoice.student_name, invoice.teacher_name ? t('invoices.proof_teacher', { name: invoice.teacher_name }) : null].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
              </View>

              {/* 1 · Transfer to one of the teacher's numbers (informational; the name helps the parent trust it). */}
              <ProofStep n={1} title={t('invoices.proof_step_transfer')} />
              <View style={{ gap: spacing.sm }}>
                {(invoice.payment_methods ?? []).length > 0 ? (
                  (invoice.payment_methods ?? []).map((m) => (
                    <View key={m.type} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="phone" size={19} color={colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{m.label}</Text>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, marginTop: 1, writingDirection: 'ltr', alignSelf: 'flex-start' }} selectable>{m.number}</Text>
                        {m.name ? (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 }}>
                            {t('invoices.expected_name')}: <Text style={{ fontFamily: fonts.medium, color: colors.textPrimary }}>{m.name}</Text>
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>{t('invoices.no_teacher_number')}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>{t('invoices.long_press_copy')}</Text>

              {/* 2 · The screenshot of the transfer. */}
              <ProofStep n={2} title={t('invoices.proof_step_upload')} />
              <TouchableOpacity activeOpacity={0.85} onPress={pickImage} accessibilityRole="button"
                style={{ borderWidth: 1.5, borderColor: imageUri ? colors.success : colors.borderStrong, borderStyle: imageUri ? 'solid' : 'dashed', borderRadius: radius.lg, backgroundColor: colors.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', minHeight: 140 }}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: 220 }} contentFit="contain" />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm }}>
                      <Icon name="success" size={15} color={colors.success} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.success }}>{t('invoices.screenshot_selected')}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>· {t('invoices.proof_change')}</Text>
                    </View>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', padding: spacing.lg }}>
                    <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="image" size={26} color={colors.brand} />
                    </View>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary, marginTop: spacing.sm }}>{t('invoices.pick_screenshot')}</Text>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{t('invoices.proof_pick_hint')}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.85} disabled={!imageUri || submit.isPending} onPress={onSubmit} accessibilityRole="button"
                style={{ marginTop: spacing.lg, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: !imageUri || submit.isPending ? colors.border : colors.primary, borderRadius: radius.lg }}>
                {submit.isPending ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={18} color="#fff" />}
                <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: '#fff' }}>{t('invoices.submit_proof')}</Text>
              </TouchableOpacity>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.sm }}>{t('invoices.proof_after')}</Text>

              <TouchableOpacity activeOpacity={0.8} onPress={close} style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invoices.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
      </SheetModal>
    </>
  );
}

function ProofStep({ n, title }: { n: number; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: '#fff' }}>{formatNumber(n)}</Text>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}
