import { TouchableOpacity, View, Text } from 'react-native';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, textPresets } from '@/theme/index';
import { Badge } from '@/components/ui/Badge';
import { useTranslation } from 'react-i18next';
import type { SessionInstance } from '@/types/session-instance';

interface SessionCardProps {
  session: SessionInstance;
  onPress: () => void;
}

const statusBadgeVariant: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  live: 'success',
  scheduled: 'warning',
  completed: 'info',
  cancelled: 'danger',
};

const statusLabels: Record<string, string> = {
  live: 'session.live',
  scheduled: 'session.scheduled',
  completed: 'session.completed',
  cancelled: 'session.cancelled',
};

export function SessionCard({ session, onPress }: SessionCardProps) {
  const { t } = useTranslation();
  const scheduledTime = new Date(session.scheduled_at);

  const formattedTime = scheduledTime.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = scheduledTime.toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessible
      accessibilityRole="button"
      accessibilityLabel={t('session.view_session', { course: session.course_name || '' })}
      style={{
        backgroundColor: colors.white,
        borderRadius: radius.xl,
        padding: spacing.lg,
        marginBottom: spacing.md,
        ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={textPresets.subtitle}>
            {session.course_name}
          </Text>
          {session.grade_name ? (
            <Text style={[textPresets.bodySmall, { marginTop: spacing.xs }]}>
              {session.grade_name}
            </Text>
          ) : null}
        </View>
        <Badge
          label={t(statusLabels[session.status] || 'session.scheduled')}
          variant={statusBadgeVariant[session.status] || 'warning'}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>
          {formattedTime}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textTertiary, marginHorizontal: spacing.sm }}>
          |
        </Text>
        <Text style={textPresets.bodySmall}>
          {t('session.duration_minutes', { minutes: session.duration_minutes })}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
        <Text style={textPresets.caption}>
          {formattedDate}
        </Text>
        <Text style={{ fontSize: 16, color: colors.textTertiary, transform: [{ scaleX: -1 }] }}>{'<'}</Text>
      </View>
    </TouchableOpacity>
  );
}
