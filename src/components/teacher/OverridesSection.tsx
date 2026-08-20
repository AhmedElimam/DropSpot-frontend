import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, layout } from '@/theme/index';
import { useAuthStore } from '@/stores/authStore';
import { useActiveAbilities, ABILITY } from '@/hooks/useActiveAbilities';
import { Icon } from '@/components/ui/Icon';
import { useBillingOverrides, useRevokeBillingOverride } from '@/hooks/useOverrides';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

/**
 * Billing exceptions on the teacher Home (§1). A teacher — or an assistant granted
 * scan_attendance — may GRANT one (the owning teacher is notified server-side);
 * REVOKE stays teacher-only, so an assistant sees the list read-only with a note.
 * The server enforces all of this regardless of the UI.
 *
 * Granting opens a dedicated page (/(teacher)/grant-exception) rather than a popup —
 * the full page makes searching by name/code and jumping to the profile comfortable.
 */
export function OverridesSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAssistant = user?.user_type_id === 6;
  const { can } = useActiveAbilities();
  // GRANT is allowed for a teacher, or an assistant with scan_attendance (mirrors
  // the server route gate). Revoke stays teacher-only.
  const canGrant = can(ABILITY.SCAN);

  const overrides = useBillingOverrides();
  const revokeOverride = useRevokeBillingOverride();

  return (
    <View style={{ gap: layout.cardGap }}>
      {/* Header — title + grant action (or a teacher-only note for assistants) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{t('teacher.billing_overrides')}</Text>
        {canGrant ? (
          <TouchableOpacity
            onPress={() => router.push('/(teacher)/grant-exception' as Href)}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandWash, borderRadius: radius.chip, paddingVertical: 7, paddingHorizontal: spacing.md }}
          >
            <Icon name="add" size={15} color={colors.brand} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.brand }}>{t('teacher.grant_override')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="lock" size={13} color={colors.faint} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.faint }}>{t('teacher.teacher_only')}</Text>
          </View>
        )}
      </View>

      {isAssistant ? (
        <View style={{ backgroundColor: colors.brandWash, borderRadius: radius.card, padding: spacing.md }}>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.muted }}>
            {canGrant ? t('teacher.assistant_can_grant_override_note') : t('teacher.assistant_override_note')}
          </Text>
        </View>
      ) : null}

      {overrides.isLoading ? (
        <ActivityIndicator color={colors.brand} />
      ) : !overrides.data?.length ? (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...shadows.sm }}>
          <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.goodWash, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="success" size={18} color={colors.good} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>{t('teacher.no_overrides')}</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.card, overflow: 'hidden', ...shadows.sm }}>
          {overrides.data.map((o, i) => {
            const revoking = revokeOverride.isPending && revokeOverride.variables === o.id;
            return (
              <View
                key={o.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 14, paddingHorizontal: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.line }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandWash, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="money" size={18} color={colors.brand} outline />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }} numberOfLines={1}>{o.student_name ?? '—'}</Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>{t('teacher.until')} {fmtDate(o.expires_at)}</Text>
                </View>
                {!isAssistant ? (
                  <TouchableOpacity
                    onPress={() => revokeOverride.mutate(o.id)}
                    disabled={revoking}
                    style={{ paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: radius.chip, backgroundColor: colors.dangerWash }}
                  >
                    {revoking ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.danger }}>{t('teacher.revoke')}</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
