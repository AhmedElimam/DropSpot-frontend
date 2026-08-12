import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { Icon } from '@/components/ui/Icon';
import {
  useCheckinPermissions,
  useBillingOverrides,
  useRevokeCheckinPermission,
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
 *
 * Granting a billing exception opens a dedicated page (/(teacher)/grant-exception)
 * rather than a popup — the full page makes searching by name/code and jumping to
 * the student profile comfortable.
 */
export function OverridesSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAssistant = user?.user_type_id === 6;

  const permissions = useCheckinPermissions();
  const overrides = useBillingOverrides();
  const revokePermission = useRevokeCheckinPermission();
  const revokeOverride = useRevokeBillingOverride();

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
            onPress={() => router.push('/(teacher)/grant-exception' as Href)}
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
    </View>
  );
}
