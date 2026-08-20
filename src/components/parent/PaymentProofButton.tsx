import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, fonts } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { useSubmitPaymentProof } from '@/hooks/useInvoices';
import type { Invoice } from '@/api/invoices';

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
        onError: () => Alert.alert('', t('invoices.proof_failed')),
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
          backgroundColor: colors.brand, borderRadius: 15, height: 40,
        }}
      >
        <Icon name="invoices" size={16} color="#fff" outline />
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{t('invoices.pay_transfer')}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, maxHeight: '85%' }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.xs }}>
                {t('invoices.pay_transfer')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, marginBottom: spacing.md }}>
                {t('invoices.transfer_intro')}
              </Text>

              {/* Where to send money — each method the teacher configured, with the
                  expected receiving-account name so a name mismatch doesn't make the
                  parent doubt the number. Informational only. */}
              <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
                {(invoice.payment_methods ?? []).length > 0 ? (
                  (invoice.payment_methods ?? []).map((m) => (
                    <View key={m.type} style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{m.label}</Text>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginTop: 4 }} selectable>
                        {m.number}
                      </Text>
                      {m.name ? (
                        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                          {t('invoices.expected_name')}: <Text style={{ fontFamily: fonts.medium, color: colors.textPrimary }}>{m.name}</Text>
                        </Text>
                      ) : null}
                    </View>
                  ))
                ) : (
                  <View style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }}>
                    <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                      {t('invoices.no_teacher_number')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Screenshot picker + preview. */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={pickImage}
                style={{
                  borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.md,
                  padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
                }}
              >
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={{ width: '100%', height: 200, borderRadius: radius.sm, resizeMode: 'contain' }} />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.success, marginTop: spacing.sm }}>
                      {t('invoices.screenshot_selected')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="invoices" size={28} color={colors.textSecondary} outline />
                    <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm }}>
                      {t('invoices.pick_screenshot')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                disabled={!imageUri || submit.isPending}
                onPress={onSubmit}
                style={{
                  backgroundColor: !imageUri || submit.isPending ? colors.border : colors.primary,
                  borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm,
                }}
              >
                {submit.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('invoices.submit_proof')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.8} onPress={close} style={{ paddingVertical: spacing.sm, alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary }}>{t('invoices.cancel')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
