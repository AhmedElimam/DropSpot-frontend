import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
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
    <View style={{ marginBottom: spacing.lg }}>
      {invites.map((inv) => (
        <View
          key={inv.id}
          style={{ backgroundColor: colors.infoLight, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.info, padding: spacing.lg, marginBottom: spacing.md }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Icon name="teacher" size={20} color={colors.infoText} />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.infoText }}>
              {t('teacher.invite_from', { name: inv.teacher_name ?? '—' })}
            </Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.infoText, marginBottom: spacing.md }}>
            {t('teacher.invite_hint')}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity
              onPress={() => respond.mutate({ id: inv.id, action: 'reject' })}
              disabled={respond.isPending}
              activeOpacity={0.85}
              style={{ flex: 1, minHeight: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.danger }}>{t('teacher.invite_reject')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => respond.mutate({ id: inv.id, action: 'accept' })}
              disabled={respond.isPending}
              activeOpacity={0.85}
              style={{ flex: 2, minHeight: 46, borderRadius: radius.lg, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' }}
            >
              {busyFor(inv.id) ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('teacher.invite_accept')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
