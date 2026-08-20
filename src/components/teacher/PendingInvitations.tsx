import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { usePendingInvitations, useRespondInvitation } from '@/hooks/useAssistantInvites';

/**
 * Assistant consent surface on the teacher Home: pending invitations to work for a
 * teacher, each with inline Accept / Reject (same shape as the parent pre-card
 * invite card). Renders nothing when there's nothing to act on.
 */
export function PendingInvitations() {
  const { t } = useTranslation();
  const { data: invites } = usePendingInvitations();
  const respond = useRespondInvitation();

  if (!invites?.length) return null;

  const busyFor = (id: number) => respond.isPending && respond.variables?.id === id;

  return (
    <View style={{ gap: spacing.md }}>
      {invites.map((inv) => (
        <View
          key={inv.id}
          style={{ backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 15, ...shadows.sm }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.brandWash, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="teacher" size={18} color={colors.brand} outline />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>
                {t('teacher.invite_from', { name: inv.teacher_name ?? '—' })}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 }}>
                {t('teacher.invite_hint')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => respond.mutate({ id: inv.id, action: 'reject' })}
              disabled={respond.isPending}
              activeOpacity={0.85}
              style={{ flex: 1, height: 44, borderRadius: 15, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.danger }}>{t('teacher.invite_reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => respond.mutate({ id: inv.id, action: 'accept' })}
              disabled={respond.isPending}
              activeOpacity={0.85}
              style={{ flex: 2, height: 44, borderRadius: 15, backgroundColor: colors.brand, justifyContent: 'center', alignItems: 'center' }}
            >
              {busyFor(inv.id) ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>{t('teacher.invite_accept')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
