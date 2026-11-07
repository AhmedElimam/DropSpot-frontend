import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { isAxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { router, useLocalSearchParams } from 'expo-router';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { activationParentCode, activationFixRequest, type ActivationTeacher } from '@/api/auth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isEgyptPhone } from '@/utils/validators';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AuthScaffold, AuthBanner } from '@/components/auth/AuthScaffold';
import { AuthField } from '@/components/auth/AuthField';

const digits = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 11);
const full = (v: string) => v.length === 11 && isEgyptPhone(v);
/** A number inside Arabic text keeps its order («01•••••333», not «333•••••01»). */
const ltr = (v: string) => `\u2066${v}\u2069`;

/**
 * A student the teacher recorded activates with the code sent to their PARENT (founder
 * 2026-11-07): they type the parent's number; only the number on file gets the code, which also
 * proves it. A number that isn't the one on file → «رقم ولي أمري اتسجّل غلط», a ticket to the
 * teacher they pick, who fixes it from the ticket after calling them.
 */
export default function ActivateParentScreen() {
  const { t } = useTranslation();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [parentPhone, setParentPhone] = useState('');
  const [proposed, setProposed] = useState('');
  const [teacherId, setTeacherId] = useState<number | null>(null);

  const send = useMutation({ mutationFn: (pp: string) => activationParentCode(phone ?? '', pp) });
  const ask = useMutation({ mutationFn: () => activationFixRequest(phone ?? '', proposed, teacherId ?? 0) });

  // A wrong / missing parent number answers with the student's teachers to ask.
  const refusal = (() => {
    const e = send.error;
    if (!isAxiosError(e)) return null;
    const code = e.response?.data?.code as string | undefined;
    const teachers = (e.response?.data?.errors?.teachers ?? []) as ActivationTeacher[];
    return { code, teachers, hint: e.response?.data?.errors?.parent_hint as string | null | undefined };
  })();
  const canAsk = !!refusal && refusal.teachers.length > 0;

  const handleSend = () => {
    if (!full(parentPhone) || send.isPending) return;
    ask.reset();
    send.mutate(parentPhone, {
      onSuccess: (res) => router.replace({
        pathname: '/(auth)/reset-password',
        params: { phone: res.phone_number, mode: 'activate', via: 'parent', hint: res.parent_hint ?? '', pp: parentPhone },
      }),
      onError: () => {
        setProposed((p) => p || parentPhone);
        setTeacherId((id) => id);
      },
    });
  };

  const chosen = teacherId ?? refusal?.teachers[0]?.id ?? null;
  const handleAsk = () => {
    if (!full(proposed) || !chosen || ask.isPending) return;
    if (teacherId == null) setTeacherId(chosen);
    ask.mutate();
  };

  if (ask.isSuccess) {
    return (
      <AuthScaffold onBack={() => router.back()} title={t('auth.act_parent_requested_title')}>
        <AuthBanner tone="success" text={ask.data} />
        <Button title={t('auth.login')} onPress={() => router.dismissTo('/(auth)/login')} />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold onBack={() => router.back()} title={t('auth.act_parent_title')} subtitle={t('auth.act_parent_subtitle')}>
      {send.isError ? <AuthBanner tone={canAsk ? 'info' : 'danger'} text={getFriendlyErrorMessage(send.error)} /> : null}

      <AuthField
        label={t('auth.act_parent_phone')}
        icon="call"
        value={parentPhone}
        onChangeText={(v) => { setParentPhone(digits(v)); if (send.isError) send.reset(); }}
        keyboardType="phone-pad"
        maxLength={11}
        placeholder="01xxxxxxxxx"
        returnKeyType="send"
        onSubmitEditing={handleSend}
        valid={full(parentPhone)}
        autoFocus
        containerStyle={{ marginBottom: spacing.lg }}
      />
      <Button title={t('auth.act_parent_send')} onPress={handleSend} disabled={!full(parentPhone)} loading={send.isPending} />

      {canAsk ? (
        <View style={{ marginTop: spacing.xl, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('auth.act_fix_title')}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary }}>
            {refusal?.hint ? t('auth.act_fix_on_file', { hint: ltr(refusal.hint) }) : t('auth.act_fix_none_on_file')}
          </Text>
          {refusal?.teachers.map((tc) => {
            const on = chosen === tc.id;
            return (
              <TouchableOpacity key={tc.id} onPress={() => setTeacherId(tc.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md,
                  borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
                <Icon name={on ? 'success' : 'profile'} size={18} color={on ? colors.brand : colors.textTertiary} />
                <Text style={{ flex: 1, fontFamily: on ? fonts.bold : fonts.medium, fontSize: 14.5, color: colors.textPrimary }}>{tc.name}</Text>
              </TouchableOpacity>
            );
          })}
          <AuthField
            label={t('auth.act_fix_right_number')}
            icon="call"
            value={proposed}
            onChangeText={(v) => setProposed(digits(v))}
            keyboardType="phone-pad"
            maxLength={11}
            placeholder="01xxxxxxxxx"
            valid={full(proposed)}
          />
          {ask.isError ? <AuthBanner tone="danger" text={getFriendlyErrorMessage(ask.error)} /> : null}
          <Button title={t('auth.act_fix_send')} variant="outline" onPress={handleAsk} disabled={!full(proposed) || !chosen} loading={ask.isPending} />
        </View>
      ) : null}
    </AuthScaffold>
  );
}
