import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { Icon } from '@/components/ui/Icon';
import { searchStudents, type StudentHit } from '@/api/teacher';
import {
  useCheckinPermissions,
  useBillingOverrides,
  useRevokeCheckinPermission,
  useGrantBillingOverride,
  useRevokeBillingOverride,
} from '@/hooks/useOverrides';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

/**
 * Overrides section for the teacher Home tab (§1). Teachers grant/revoke; an
 * assistant sees the same lists read-only with a clear "teacher only" note — the
 * server also hard-blocks assistant grant/revoke regardless of this UI.
 */
export function OverridesSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAssistant = user?.user_type_id === 6;

  const permissions = useCheckinPermissions();
  const overrides = useBillingOverrides();
  const revokePermission = useRevokeCheckinPermission();
  const revokeOverride = useRevokeBillingOverride();

  const [grantOpen, setGrantOpen] = useState(false);

  const sectionTitle = (icon: 'phone' | 'money', title: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{title}</Text>
    </View>
  );

  const row = (
    key: string,
    name: string | null,
    sub: string,
    onRevoke?: () => void,
    revoking?: boolean,
  ) => (
    <View
      key={key}
      style={{
        flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
        borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
        padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{name ?? '—'}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{sub}</Text>
      </View>
      {onRevoke ? (
        <TouchableOpacity
          onPress={onRevoke}
          disabled={revoking}
          style={{ paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerLight }}
        >
          {revoking ? (
            <ActivityIndicator size="small" color={colors.dangerText} />
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>{t('teacher.revoke')}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('teacher.overrides')}</Text>
        {isAssistant ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="lock" size={14} color={colors.textTertiary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textTertiary }}>{t('teacher.teacher_only')}</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setGrantOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: spacing.md }}
          >
            <Icon name="add" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>{t('teacher.grant_override')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isAssistant ? (
        <View style={{ backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
            {t('teacher.assistant_override_note')}
          </Text>
        </View>
      ) : null}

      {/* Billing overrides */}
      {sectionTitle('money', t('teacher.billing_overrides'))}
      {overrides.isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : !overrides.data?.length ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary, marginBottom: spacing.md }}>{t('teacher.no_overrides')}</Text>
      ) : (
        overrides.data.map((o) =>
          row(
            `o${o.id}`,
            o.student_name,
            `${t('teacher.until')} ${fmtDate(o.expires_at)}`,
            isAssistant ? undefined : () => revokeOverride.mutate(o.id),
            revokeOverride.isPending && revokeOverride.variables === o.id,
          ),
        )
      )}

      {/* Check-in permissions */}
      <View style={{ marginTop: spacing.md }}>
        {sectionTitle('phone', t('teacher.phone_permissions'))}
        {permissions.isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !permissions.data?.length ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{t('teacher.no_permissions')}</Text>
        ) : (
          permissions.data.map((p) =>
            row(
              `p${p.id}`,
              p.student_name,
              `${p.course_name ?? ''} · ${t('teacher.until')} ${fmtDate(p.expires_at)}`,
              isAssistant ? undefined : () => revokePermission.mutate(p.id),
              revokePermission.isPending && revokePermission.variables === p.id,
            ),
          )
        )}
      </View>

      {!isAssistant ? <GrantOverrideModal open={grantOpen} onClose={() => setGrantOpen(false)} /> : null}
    </View>
  );
}

/** Teacher-only: grant a billing override to a searched student. */
function GrantOverrideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<StudentHit | null>(null);
  const [reason, setReason] = useState('');
  const grant = useGrantBillingOverride();

  const results = useQuery({
    queryKey: ['student-search', query],
    queryFn: () => searchStudents(query),
    enabled: query.trim().length >= 2 && !selected,
  });

  const reset = () => {
    setQuery('');
    setSelected(null);
    setReason('');
  };

  const submit = () => {
    if (!selected) return;
    grant.mutate(
      { student_id: Number(selected.id), reason: reason.trim() || undefined },
      { onSuccess: () => { reset(); onClose(); } },
    );
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{t('teacher.grant_billing_override')}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}><Icon name="back" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          {selected ? (
            <View style={{ backgroundColor: colors.primaryLight, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.textPrimary }}>{selected.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><Text style={{ fontFamily: fonts.medium, color: colors.primary }}>{t('teacher.change')}</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('teacher.search_student')}
                placeholderTextColor={colors.textTertiary}
                style={{
                  fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface,
                  borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg,
                  paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right', marginBottom: spacing.md,
                }}
              />
              {results.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
              <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
                {(results.data ?? []).map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => setSelected(s)}
                    style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.textPrimary }}>{s.name}</Text>
                    {s.subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textTertiary }}>{s.subtitle}</Text> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {selected ? (
            <>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={t('teacher.reason_optional')}
                placeholderTextColor={colors.textTertiary}
                style={{
                  fontFamily: fonts.regular, fontSize: 16, minHeight: 52, backgroundColor: colors.surface,
                  borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg,
                  paddingHorizontal: spacing.lg, color: colors.textPrimary, textAlign: 'right', marginVertical: spacing.md,
                }}
              />
              <TouchableOpacity
                onPress={submit}
                disabled={grant.isPending}
                style={{ minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}
              >
                {grant.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: '#fff' }}>{t('teacher.grant_15_days')}</Text>}
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
