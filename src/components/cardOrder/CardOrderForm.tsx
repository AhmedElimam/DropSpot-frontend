import { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { getCardOrderTargets, createFamilyCardOrder, type CardOrderTarget } from '@/api/cardOrders';

/**
 * The family self-order screen body (student self / parent for a child). Routes here
 * from the homepage banner. Picks the student (pre-selected when there's one), captures
 * the delivery address + payment (cash-on-delivery, or pay-now to the teacher's number
 * with a proof screenshot), and files a SUBMITTED order for super-admin review.
 */
export function CardOrderForm({ preselectStudentId }: { preselectStudentId?: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: targets, isLoading } = useQuery({ queryKey: ['card-order-targets'], queryFn: getCardOrderTargets });

  const [studentId, setStudentId] = useState<number | undefined>(preselectStudentId);
  const [address, setAddress] = useState('');
  const [payment, setPayment] = useState<'cash_on_delivery' | 'pay_now'>('cash_on_delivery');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = targets ?? [];
  const selected: CardOrderTarget | undefined = useMemo(
    () => list.find((tgt) => tgt.student_id === studentId) ?? (list.length === 1 ? list[0] : undefined),
    [list, studentId],
  );

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setImageUri(result.assets[0].uri);
  };

  const canSubmit =
    !!selected && selected.can_order && address.trim().length >= 10 && (payment === 'cash_on_delivery' || !!imageUri) && !busy;

  const submit = async () => {
    if (!selected || !canSubmit) return;
    setBusy(true);
    try {
      await createFamilyCardOrder({
        student_id: selected.student_id,
        delivery_address: address.trim(),
        payment_option: payment,
        imageUri,
      });
      qc.invalidateQueries({ queryKey: ['card-order-targets'] });
      Alert.alert(t('card_order.submitted'), '', [{ text: t('common.ok'), onPress: () => router.back() }]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || t('card_order.error');
      Alert.alert(t('card_order.error'), msg);
    } finally {
      setBusy(false);
    }
  };

  const Header = () => (
    <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
        <Icon name="forward" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary }}>{t('card_order.order_title')}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header />
        <ActivityIndicator style={{ marginTop: spacing.xxl }} color={colors.brand} />
      </View>
    );
  }

  const cardStyle = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg, ...shadows.sm } as const;
  const input = { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <Header />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
        {/* Perks */}
        <View style={cardStyle}>
          <PerkRow icon="attendance" text={t('card_order.perk_scan')} />
          <View style={{ height: spacing.sm }} />
          <PerkRow icon="warning" text={t('card_order.perk_bridge')} />
        </View>

        {/* Student picker — only when there's more than one and none pre-selected. */}
        {list.length > 1 ? (
          <View style={cardStyle}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('card_order.choose_student')}</Text>
            {list.map((tgt) => (
              <TouchableOpacity
                key={tgt.student_id}
                onPress={() => setStudentId(tgt.student_id)}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected?.student_id === tgt.student_id ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  {selected?.student_id === tgt.student_id ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{tgt.name}{tgt.grade ? ` — ${tgt.grade}` : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {selected && !selected.can_order ? (
          <View style={cardStyle}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
              {selected.reason === 'PENDING_REVIEW' ? t('card_order.pending') : t('card_order.no_teacher')}
            </Text>
          </View>
        ) : null}

        {selected && selected.can_order ? (
          <>
            {/* Delivery */}
            <View style={cardStyle}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('card_order.delivery_address')}</Text>
              <TextInput value={address} onChangeText={setAddress} placeholder={t('card_order.delivery_ph')} placeholderTextColor={colors.textTertiary} multiline style={[input, { minHeight: 76, textAlignVertical: 'top' }]} />
            </View>

            {/* Payment */}
            <View style={cardStyle}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('card_order.payment')}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['cash_on_delivery', 'pay_now'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPayment(p)}
                    activeOpacity={0.85}
                    style={{ flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: payment === p ? colors.brand : colors.border, backgroundColor: payment === p ? colors.brandTint : colors.surface, alignItems: 'center' }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: payment === p ? colors.brand : colors.textSecondary }}>
                      {t(p === 'cash_on_delivery' ? 'card_order.pay_cod' : 'card_order.pay_now')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {payment === 'pay_now' ? (
                <View style={{ marginTop: spacing.md }}>
                  {selected.card_instapay ? (
                    <View style={{ backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: spacing.xs }}>{t('card_order.pay_to')}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                        إنستا باي (InstaPay): <Text style={{ fontFamily: fonts.bold }}>{selected.card_instapay.number}</Text> — {selected.card_instapay.name}
                      </Text>
                      {selected.card_vodafone ? (
                        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                          فودافون كاش (Vodafone Cash): <Text style={{ fontFamily: fonts.bold }}>{selected.card_vodafone}</Text>
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm }}>{t('card_order.upload_proof')}</Text>
                  {imageUri ? <Image source={{ uri: imageUri }} style={{ width: '100%', height: 160, borderRadius: radius.md, marginBottom: spacing.sm, resizeMode: 'contain' }} /> : null}
                  <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={{ paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{t('card_order.pick_image')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={submit}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{ opacity: canSubmit ? 1 : 0.5, backgroundColor: colors.brand, borderRadius: radius.lg, paddingVertical: spacing.lg, alignItems: 'center' }}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('card_order.submit')}</Text>}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PerkRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={icon} size={18} color={colors.brand} />
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}
