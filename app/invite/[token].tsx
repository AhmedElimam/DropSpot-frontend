import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, gradients, control } from '@/theme/index';
import { getInvitation } from '@/api/invitation';
import { useAcceptInvite } from '@/hooks/useAuth';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { Icon } from '@/components/ui/Icon';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { TermsConsentRow } from '@/components/auth/TermsConsentRow';

const RELATIONS = ['father', 'mother', 'guardian'] as const;
const hasLatinLetters = (v: string) => /[A-Za-z]/.test(v);

const label = { fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: spacing.sm } as const;
const field = {
  fontFamily: fonts.regular,
  fontSize: 17,
  minHeight: control.minHeight,
  backgroundColor: colors.surfaceSunken,
  borderRadius: radius.lg,
  paddingHorizontal: spacing.lg,
  paddingVertical: 14,
  color: colors.textPrimary,
  textAlign: 'right' as const,
  borderWidth: 1.5,
};

export default function InviteAcceptScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentRelation, setParentRelation] = useState<string>('');
  const [terms, setTerms] = useState(false);

  const { data: info, isLoading, isError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => getInvitation(token as string),
    enabled: !!token,
    retry: false,
  });

  // Prefill the parent phone the teacher put on the invite (still editable).
  useEffect(() => {
    if (info?.parent_phone) setParentPhone((p) => p || info.parent_phone!);
  }, [info]);

  const acceptMutation = useAcceptInvite();

  const needsName = !!info && !info.invited_student_name;
  const nameHasLatin = hasLatinLetters(name);
  const parentNameHasLatin = hasLatinLetters(parentName);
  const nameOk = !needsName || (name.trim().length > 0 && !nameHasLatin);
  const isValid =
    password.length >= 6 && password === confirmPassword && nameOk &&
    parentName.trim().length > 0 && !parentNameHasLatin && parentPhone.trim().length > 0 &&
    parentRelation && terms;
  const canSubmit = isValid && !acceptMutation.isPending;

  const submit = () => {
    if (!token || !canSubmit) return;
    acceptMutation.mutate(
      {
        token: token as string,
        password,
        name: needsName ? name.trim() : undefined,
        parent_name: parentName.trim(),
        parent_phone: parentPhone.trim(),
        parent_relation: parentRelation,
        terms_accepted: terms,
      },
      { onSuccess: () => router.replace('/(student)') },
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (isError || !info) {
    return (
      <AuthScaffold icon="warning" title={t('invite.invalid_title')} subtitle={t('invite.invalid_link')}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}
          style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse }}>{t('invite.go_login')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  // A legacy parent-centric invite isn't completed on this student screen.
  if (!info.student_centric) {
    return (
      <AuthScaffold icon="profile" title={t('invite.title')} subtitle={t('invite.parent_note')}>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.85}
          style={{ borderRadius: radius.lg, overflow: 'hidden' }}>
          <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse }}>{t('invite.go_login')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </AuthScaffold>
    );
  }

  const invitedBy = [info.teacher_name, info.course_name].filter(Boolean).join(' — ');

  return (
    <AuthScaffold icon="profile" title={t('invite.title')} subtitle={t('invite.subtitle')}>
      {acceptMutation.isError && (
        <View style={{ backgroundColor: colors.dangerLight, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.danger }}>
          <Icon name="warning" size={18} color={colors.danger} style={{ marginEnd: spacing.sm }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.dangerText, flex: 1 }}>
            {getFriendlyErrorMessage(acceptMutation.error)}
          </Text>
        </View>
      )}

      {!!invitedBy && (
        <View style={{ backgroundColor: colors.surfaceSunken, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary, marginBottom: 4 }}>
            {t('invite.invited_by')}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>{invitedBy}</Text>
        </View>
      )}

      {needsName && (
        <>
          <Text style={label}>{t('invite.name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('invite.name_placeholder')}
            placeholderTextColor={colors.textTertiary}
            style={{ ...field, marginBottom: nameHasLatin ? spacing.xs : spacing.lg, borderColor: nameHasLatin ? colors.danger : name ? colors.brand : colors.borderStrong }}
          />
          {nameHasLatin ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.lg, textAlign: 'right' }}>{t('auth.name_arabic_only')}</Text>
          ) : null}
        </>
      )}

      {/* Parent details — same as a normal signup. */}
      <Text style={label}>{t('auth.parent_name')}</Text>
      <TextInput
        value={parentName}
        onChangeText={setParentName}
        placeholder={t('auth.parent_name_example')}
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: parentNameHasLatin ? spacing.xs : spacing.lg, borderColor: parentNameHasLatin ? colors.danger : parentName ? colors.brand : colors.borderStrong }}
      />
      {parentNameHasLatin ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.lg, textAlign: 'right' }}>{t('auth.name_arabic_only')}</Text>
      ) : null}

      <Text style={label}>{t('auth.parent_phone')}</Text>
      <TextInput
        value={parentPhone}
        onChangeText={setParentPhone}
        keyboardType="phone-pad"
        autoCapitalize="none"
        placeholder="01000000000"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.lg, borderColor: parentPhone ? colors.brand : colors.borderStrong }}
      />

      <Text style={label}>{t('auth.parent_relation')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
        {RELATIONS.map((rel) => {
          const on = parentRelation === rel;
          return (
            <TouchableOpacity
              key={rel}
              onPress={() => setParentRelation(rel)}
              activeOpacity={0.75}
              style={{ minHeight: 48, justifyContent: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: on ? colors.brandTint : colors.surfaceSunken, borderWidth: 1.5, borderColor: on ? colors.brand : colors.borderStrong }}
            >
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: on ? colors.brand : colors.textSecondary }}>{t(`auth.${rel}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={label}>{t('invite.password')}</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: spacing.lg, borderColor: password ? colors.brand : colors.borderStrong }}
      />

      <Text style={label}>{t('auth.confirm_password')}</Text>
      <PasswordInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        placeholderTextColor={colors.textTertiary}
        style={{ ...field, marginBottom: confirmPassword && password !== confirmPassword ? spacing.xs : spacing.lg, borderColor: confirmPassword ? (confirmPassword === password ? colors.success : colors.danger) : colors.borderStrong }}
      />
      {confirmPassword && password !== confirmPassword ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.danger, marginBottom: spacing.lg, textAlign: 'right' }}>{t('auth.password_mismatch')}</Text>
      ) : null}

      <TermsConsentRow role="student" checked={terms} onToggle={setTerms} />

      <TouchableOpacity
        onPress={submit}
        disabled={!canSubmit}
        activeOpacity={0.85}
        style={{ borderRadius: radius.lg, overflow: 'hidden', opacity: canSubmit ? 1 : 0.5 }}
      >
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ minHeight: control.minHeight, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textInverse, letterSpacing: 1 }}>
            {acceptMutation.isPending ? t('invite.saving') : t('invite.submit')}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </AuthScaffold>
  );
}
