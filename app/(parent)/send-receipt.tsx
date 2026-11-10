import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius, fonts, nav } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { PageHero } from '@/components/ui/PageHero';
import { EmptyState } from '@/components/ui/EmptyState';
import { Alert } from '@/ui/dialog';
import { Surface } from '@/ui/surfaces';
import { formatEGP } from '@/utils/currency';
import { dayLabel } from '@/utils/format';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { parseReceiptAmount } from '@/utils/receiptAmount';
import { submitPaymentProof } from '@/api/invoices';
import type { ShareInvoice, ShareTeacher } from '@/api/shareTargets';
import { useIncomingShare } from '@/stores/incomingShare';
import { SHARE_TARGETS_KEY, useShareTargets } from '@/hooks/useParentShareInbox';

/**
 * «إرسال إيصال الدفع» (founder 2026-11-11): a receipt shared from InstaPay or Vodafone Cash
 * lands here — the teacher already chosen when the parent tapped them in the share sheet, the
 * invoice matching the receipt's amount pre-selected. One tap sends it to the teacher, who
 * is notified and approves it in their payment proofs.
 */
export default function SendReceiptScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const share = useIncomingShare((s) => s.share);
  const clearShare = useIncomingShare((s) => s.set);
  const targets = useShareTargets();
  const list = useMemo(() => targets.data ?? [], [targets.data]);

  const sharedImage = share?.file && share.file.mimeType.startsWith('image/') ? share.file.uri : null;
  const [imageUri, setImageUri] = useState<string | null>(sharedImage);
  const [teacherId, setTeacherId] = useState<number | null>(share?.teacherId ? Number(share.teacherId) : null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ teacher: string; amount: number } | null>(null);
  const amount = parseReceiptAmount(share?.text);

  // A new share while this screen is open replaces the receipt and the teacher.
  useEffect(() => {
    setImageUri(sharedImage);
    if (share?.teacherId) setTeacherId(Number(share.teacherId));
    setSent(null);
  }, [share, sharedImage]);

  // One teacher owed: no choice to make.
  const teacher: ShareTeacher | null = list.find((x) => x.teacher_id === teacherId)
    ?? (list.length === 1 ? list[0] : null);

  // The invoice: the one whose remainder is the receipt's amount, else the oldest still due.
  useEffect(() => {
    if (!teacher) { setInvoiceId(null); return; }
    if (invoiceId && teacher.invoices.some((i) => i.id === invoiceId)) return;
    const match = amount != null ? teacher.invoices.find((i) => Math.abs(i.remaining - amount) < 0.01) : undefined;
    setInvoiceId((match ?? teacher.invoices[0])?.id ?? null);
  }, [teacher, amount, invoiceId]);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('', t('invoices.permission_needed')); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setImageUri(r.assets[0].uri);
  };

  const send = async () => {
    if (!teacher || !invoiceId || !imageUri) return;
    const invoice = teacher.invoices.find((i) => i.id === invoiceId);
    setSending(true);
    try {
      await submitPaymentProof(invoiceId, imageUri);
      setSent({ teacher: teacher.name ?? '', amount: invoice?.remaining ?? 0 });
      clearShare(null);
      // The share sheet drops this teacher once nothing is left to send them.
      qc.invalidateQueries({ queryKey: SHARE_TARGETS_KEY });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    } catch (e) {
      Alert.alert('', getFriendlyErrorMessage(e) || t('invoices.proof_failed'));
    } finally {
      setSending(false);
    }
  };

  const done = () => (router.canGoBack() ? router.back() : router.replace('/(parent)/(tabs)' as Href));

  if (sent) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="success" size={36} color={colors.success} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, textAlign: 'center' }}>{t('send_receipt.sent_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: colors.textSecondary, textAlign: 'center' }}>
            {t('send_receipt.sent_body', { teacher: sent.teacher, amount: formatEGP(sent.amount) })}
          </Text>
          <Button title={t('send_receipt.done')} onPress={done} style={{ alignSelf: 'stretch', marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  const header = (
    <View style={{ gap: spacing.md }}>
      {/* The receipt. */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('send_receipt.receipt')}</Text>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: 260, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }} contentFit="contain" accessibilityLabel={t('send_receipt.receipt')} />
        ) : (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary }}>
            {share?.text ? t('send_receipt.text_only') : t('send_receipt.no_image')}
          </Text>
        )}
        {share?.text ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }} numberOfLines={3}>{share.text}</Text>
        ) : null}
        <TouchableOpacity onPress={pick} activeOpacity={0.85} accessibilityRole="button"
          style={{ minHeight: 40, borderRadius: radius.md, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <Icon name="image" size={16} color={colors.brand} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.brand }}>{imageUri ? t('send_receipt.change_image') : t('send_receipt.pick_image')}</Text>
        </TouchableOpacity>
      </View>

      {/* The teacher — only those still owed. */}
      <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{t('send_receipt.to_teacher')}</Text>
      <FlatList
        horizontal
        data={list}
        keyExtractor={(x) => String(x.teacher_id)}
        initialNumToRender={6}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => {
          const on = teacher?.teacher_id === item.teacher_id;
          return (
            <TouchableOpacity onPress={() => { setTeacherId(item.teacher_id); setInvoiceId(null); }} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ width: 112, alignItems: 'center', gap: 6, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
              {item.logo_url ? (
                <Image source={{ uri: item.logo_url }} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceSunken }} contentFit="cover" />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.onPrimary }}>{(item.name ?? '؟').trim().charAt(0)}</Text>
                </View>
              )}
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.textPrimary, textAlign: 'center' }} numberOfLines={2}>{item.name}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: item.overdue ? colors.dangerText : colors.textSecondary }}>{formatEGP(item.total_remaining)}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {teacher ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, marginTop: spacing.xs }}>{t('send_receipt.which_invoice')}</Text>
      ) : (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary }}>{t('send_receipt.pick_teacher')}</Text>
      )}
    </View>
  );

  const footer = teacher ? (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      {teacher.payment_methods.length > 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>
          {t('send_receipt.methods', { list: teacher.payment_methods.map((m) => `${m.label} ${m.number}`).join(' · ') })}
        </Text>
      ) : null}
      <Button
        title={t('send_receipt.send', { teacher: teacher.name ?? '' })}
        onPress={send}
        loading={sending}
        disabled={!imageUri || !invoiceId || sending}
      />
      {!imageUri ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'center' }}>{t('send_receipt.need_image')}</Text> : null}
    </View>
  ) : null;

  return (
    <Surface id="screen.parent.send_receipt" screen>
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHero title={t('send_receipt.title')} subtitle={t('send_receipt.subtitle')} onBack compact />
      {targets.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : list.length === 0 ? (
        <EmptyState icon="invoices" title={t('send_receipt.nothing_owed_title')} message={t('send_receipt.nothing_owed_body')} />
      ) : (
        <FlatList
          data={teacher?.invoices ?? []}
          keyExtractor={(i) => i.id}
          initialNumToRender={8}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: nav.pageEnd + insets.bottom }}
          renderItem={({ item }) => <InvoiceRow invoice={item} selected={item.id === invoiceId} matches={amount != null && Math.abs(item.remaining - amount) < 0.01} onPress={() => setInvoiceId(item.id)} />}
        />
      )}
    </View>
    </Surface>
  );
}

function InvoiceRow({ invoice, selected, matches, onPress }: { invoice: ShareInvoice; selected: boolean; matches: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: selected ? colors.brand : colors.border, backgroundColor: colors.surface }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.brand : colors.border, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: colors.brand }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>
          {[invoice.student_name, invoice.items[0]].filter(Boolean).join(' · ')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: invoice.status === 'overdue' ? colors.dangerText : colors.textSecondary, marginTop: 2 }}>
          {invoice.status === 'overdue' ? t('send_receipt.overdue') : invoice.due_date ? t('send_receipt.due', { day: dayLabel(invoice.due_date) }) : ''}
          {matches ? ` · ${t('send_receipt.matches')}` : ''}
        </Text>
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{formatEGP(invoice.remaining)}</Text>
    </TouchableOpacity>
  );
}
