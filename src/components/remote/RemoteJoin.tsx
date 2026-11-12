import { memo, useCallback, useRef } from 'react';
import { Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { onWhite } from '@/theme/onWhite';
import { Icon } from '@/components/ui/Icon';
import { Surface } from '@/ui/surfaces';
import { useRemoteSessionsEnabled } from '@/hooks/useRemoteSession';
import { isRemoteLive, type RemoteFlag } from '@/remote/room';

/** One push per tap: a double tap must not stack the room twice (and spend two links). */
function useOpenOnce(href: Href): () => void {
  const last = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < 900) return;
    last.current = now;
    router.push(href);
  }, [href]);
}

/**
 * «الحصة أونلاين دلوقتي — ادخل» — the student's way into a class that is on air. Drawn only
 * while the feature switch is on AND the session row says `remote.live`; otherwise nothing,
 * and the card is exactly what it was. Watching needs no camera or microphone, so there is no
 * version gate here. The room asks the server for its one-time link when it opens.
 *
 * `onColor`: on the Home spotlight's gradient (a white button, fixed ink). Default: on a card.
 */
export const StudentRemoteJoin = memo(function StudentRemoteJoin({ sessionId, remote, onColor = false, style }: {
  sessionId: number | string;
  remote: RemoteFlag | null | undefined;
  onColor?: boolean;
  /** Spacing around the button — applied only when it is drawn (never an empty gap). */
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  const open = useOpenOnce(`/(student)/remote/${sessionId}` as Href);
  if (!on || !isRemoteLive(remote)) return null;
  return (
    <Surface id="student.session.remote_join">
      <TouchableOpacity onPress={open} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('remote.join_now')}
        style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: onColor ? '#fff' : colors.brand }, style]}>
        {/* The red dot is the one «on air» mark; the button itself stays the brand's. */}
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: onColor ? onWhite.danger : colors.onPrimary }} />
        <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: onColor ? onWhite.ink : colors.onPrimary }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('remote.join_now')}</Text>
        <Icon name="video" size={18} color={onColor ? onWhite.brand : colors.onPrimary} />
      </TouchableOpacity>
    </Surface>
  );
});

/** «أونلاين دلوقتي» — a small mark for a row too small for the button (Home's today list). */
export const RemoteLiveChip = memo(function RemoteLiveChip({ remote }: { remote: RemoteFlag | null | undefined }) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  if (!on || !isRemoteLive(remote)) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.dangerLight, borderRadius: radius.full, paddingVertical: 4, paddingHorizontal: 10 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger }} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.dangerText }} numberOfLines={1}>{t('remote.live_chip')}</Text>
    </View>
  );
});

/**
 * The parent's child page: «حصة {{course}} أونلاين دلوقتي», and a button to watch it. The
 * parent enters with the CHILD's student id — the server checks the child is theirs.
 */
export const ParentRemoteLive = memo(function ParentRemoteLive({ sessionId, studentId, courseName, remote }: {
  sessionId: number | string;
  studentId: number;
  courseName: string | null | undefined;
  remote: RemoteFlag | null | undefined;
}) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  const open = useOpenOnce(`/(parent)/remote/${sessionId}?student_id=${studentId}` as Href);
  if (!on || !isRemoteLive(remote)) return null;
  return (
    <Surface id="parent.child.remote_live">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.dangerLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="video" size={20} color={colors.danger} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary }} numberOfLines={2}>
          {courseName ? t('remote.parent_live', { course: courseName }) : t('remote.parent_live_no_course')}
        </Text>
        <Surface id="parent.child.remote_watch">
          <TouchableOpacity onPress={open} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('remote.watch')} hitSlop={6}
            style={{ minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.onPrimary }}>{t('remote.watch')}</Text>
          </TouchableOpacity>
        </Surface>
      </View>
    </Surface>
  );
});
