import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { SheetModal } from '@/components/ui/SheetModal';
import { Icon } from '@/components/ui/Icon';
import { OtpInput } from '@/components/auth/OtpInput';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { teacherSendStudentNumberCode, teacherVerifyStudentNumber } from '@/api/ownNumber';

/**
 * «صحّح وأكّد الرقم» (founder, 2026-11-26). The student can't change their own number;
 * the teacher does it here, with the student in front of them: keep or correct the
 * number, send one code, type the code the student reads out. The number is saved only
 * once that code matches, and the student's app opens again.
 */
export function OwnNumberFixSheet({ visible, onClose, onDone, studentId, studentName, currentPhone }: {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
  studentId: number;
  studentName: string;
  currentPhone: string | null;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(currentPhone ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  // Each opening starts clean, on the number on file.
  useEffect(() => {
    if (visible) { setPhone(currentPhone ?? ''); setSentTo(null); setCode(''); }
  }, [visible, currentPhone]);

  const send = useMutation({
    mutationFn: () => {
      const typed = phone.trim();
      return teacherSendStudentNumberCode(studentId, typed && typed !== currentPhone ? typed : undefined);
    },
    onSuccess: (r) => { setSentTo(r.phone); setCode(''); },
  });
  const verify = useMutation({
    mutationFn: (c: string) => teacherVerifyStudentNumber(studentId, c),
    onSuccess: () => { onDone(); onClose(); },
  });

  const busy = send.isPending || verify.isPending;
  const err = verify.isError ? verify.error : send.isError ? send.error : null;
  const canSend = phone.trim().length >= 11 && !busy;
  const canVerify = code.length === 6 && !busy;

  return (
    <SheetModal visible={visible} onClose={() => !busy && onClose()} avoidKeyboard style={{ backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>
          {t('student_profile_ui.own_number_fix_title', { name: studentName })}
        </Text>
        <TouchableOpacity onPress={() => !busy && onClose()} hitSlop={10} accessibilityRole="button">
          <Icon name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginBottom: spacing.md }}>
        {t('student_profile_ui.own_number_fix_intro')}
      </Text>

      {err ? (
        <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.danger }}>
          <Icon name="warning" size={18} color={colors.danger} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.danger }}>{getFriendlyErrorMessage(err)}</Text>
        </View>
      ) : null}

      {sentTo ? (
        <>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, marginBottom: spacing.md }}>
            {t('student_profile_ui.own_number_fix_sent', { phone: sentTo })}
          </Text>
          <OtpInput value={code} onChange={setCode} onComplete={(c) => { if (!verify.isPending) verify.mutate(c); }} autoFocus />
          <TouchableOpacity
            onPress={() => canVerify && verify.mutate(code)}
            disabled={!canVerify}
            accessibilityRole="button"
            style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: canVerify ? colors.brand : colors.border, justifyContent: 'center', alignItems: 'center' }}
          >
            {verify.isPending ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('student_profile_ui.own_number_fix_confirm')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => !busy && setSentTo(null)} style={{ marginTop: spacing.md, alignItems: 'center' }} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.primary }}>{t('student_profile_ui.own_number_fix_back')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{t('student_profile_ui.own_number_fix_label')}</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={14}
            placeholder="01xxxxxxxxx"
            placeholderTextColor={colors.textTertiary}
            editable={!busy}
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 48, fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary, textAlign: 'center', backgroundColor: colors.surface, letterSpacing: 1 }}
          />
          <TouchableOpacity
            onPress={() => canSend && send.mutate()}
            disabled={!canSend}
            accessibilityRole="button"
            style={{ marginTop: spacing.lg, minHeight: 50, borderRadius: radius.lg, backgroundColor: canSend ? colors.brand : colors.border, justifyContent: 'center', alignItems: 'center' }}
          >
            {send.isPending ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('student_profile_ui.own_number_fix_send')}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </SheetModal>
  );
}
