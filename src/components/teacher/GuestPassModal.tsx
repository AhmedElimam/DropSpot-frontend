import { useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { issueGuestPass } from '@/api/guestPasses';

/**
 * Issue a session-scoped guest pass for one revision instance — a self-contained
 * bottom sheet (name + optional phone + optional flat fee + paid-now). On success it
 * opens the printable slip (QR + Code128) for an immediate scan. No student is created.
 */
export function GuestPassModal({
  visible, revisionId, instanceId, sessionTitle, onClose,
}: {
  visible: boolean;
  revisionId: number | null;
  instanceId: number | null;
  sessionTitle?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fee, setFee] = useState('');
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function reset() {
    setName(''); setPhone(''); setFee(''); setPaid(false); setErr(''); setBusy(false);
  }

  async function submit() {
    if (revisionId == null || instanceId == null) return;
    const n = name.trim();
    if (n.length < 2) { setErr(t('teacher.guest_name')); return; }
    const feeStr = fee.trim();
    const feeAmount = feeStr === '' ? undefined : Number(feeStr);
    if (feeAmount !== undefined && !(feeAmount >= 0)) { setErr(t('teacher.guest_fee_invalid')); return; }
    setErr('');
    setBusy(true);
    const res = await issueGuestPass(revisionId, instanceId, {
      name: n,
      phone: phone.trim() || undefined,
      feeAmount,
      paidNow: paid,
    });
    setBusy(false);
    if (res.success) {
      if (res.slip_url) {
        try { await WebBrowser.openBrowserAsync(res.slip_url); } catch { /* slip display is optional */ }
      }
      reset();
      onClose();
    } else {
      setErr(res.message || t('teacher.scan_failed'));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('teacher.guest_pass_title')}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {sessionTitle ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }} numberOfLines={1}>{sessionTitle}</Text>
          ) : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md }}>{t('teacher.guest_pass_hint')}</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('teacher.guest_name')}
            placeholderTextColor={colors.textTertiary}
            style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, textAlign: 'right' }}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t('teacher.guest_pass_phone_optional')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            style={{ marginTop: spacing.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, textAlign: 'right' }}
          />
          <TextInput
            value={fee}
            onChangeText={setFee}
            placeholder={t('teacher.guest_pass_fee_optional')}
            placeholderTextColor={colors.textTertiary}
            keyboardType="numeric"
            style={{ marginTop: spacing.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, height: 52, fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary, textAlign: 'right' }}
          />
          <TouchableOpacity onPress={() => setPaid((v) => !v)} activeOpacity={0.8} style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: paid ? colors.brand : colors.borderStrong, backgroundColor: paid ? colors.brand : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              {paid ? <Icon name="success" size={18} color="#fff" /> : null}
            </View>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textPrimary }}>{t('teacher.guest_pass_paid_now')}</Text>
          </TouchableOpacity>

          {err ? <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.dangerText, marginTop: spacing.md }}>{err}</Text> : null}

          <TouchableOpacity onPress={submit} disabled={busy} activeOpacity={0.85} style={{ marginTop: spacing.xl, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.guest_pass_submit')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
