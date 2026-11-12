import { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { onWhite } from '@/theme/onWhite';
import { Icon } from '@/components/ui/Icon';
import { BetaChip } from '@/components/ui/Beta';
import { SheetModal } from '@/components/ui/SheetModal';
import { Surface } from '@/ui/surfaces';
import { useAppConfig } from '@/hooks/useAppConfig';
import { REMOTE_FLAG, useRemoteSessionsEnabled, useTeacherRemote } from '@/hooks/useRemoteSession';
import { storeLinksFor } from '@/utils/storeLinks';
import { formatNumber } from '@/utils/format';
import type { TeacherRemoteState } from '@/api/remoteSession';

/**
 * Where the entry point is drawn:
 *  · card    — inside a session card (Sessions tab, Home's rest of the day), on the card's surface;
 *  · onColor — inside the Home spotlight, on its gradient (white ink, a white button);
 *  · panel   — the session's own page: a titled card with «تجريبي», the start / enter button
 *              and, while on air, «إنهاء الحصة» for a class left running or started on the website.
 */
export type TeacherRemoteVariant = 'card' | 'onColor' | 'panel';

/**
 * The teacher's «حصة أونلاين» entry point for ONE session. Draws nothing while the feature
 * switch is off, or when the row carries no `remote` field (the feature is off for this
 * teacher, or the server is older) — so a card costs nothing extra until the day it is needed.
 *
 *  · not on air, and `canStart` (today's session, not cancelled) → «ابدأ حصة أونلاين»;
 *  · on air → «مباشر الآن», how many are watching, and «ادخل الحصة».
 *
 * The teacher's alone: the server refuses an assistant, so an assistant never sees it
 * (`assistantNeeds="teacher"`; the backend's `ui.gates` can reopen it).
 */
export const TeacherRemoteAction = memo(function TeacherRemoteAction({ sessionId, remote, canStart, variant, style }: {
  sessionId: string;
  remote: TeacherRemoteState | null | undefined;
  canStart: boolean;
  variant: TeacherRemoteVariant;
  /** Spacing around the entry point — applied only when something is drawn (never an empty gap). */
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const on = useRemoteSessionsEnabled();
  const room = useTeacherRemote(sessionId);
  // The «حدّث التطبيق» sheet is mounted from its first opening on, never for a card that did not need it.
  const [sheetEver, setSheetEver] = useState(false);
  useEffect(() => { if (room.needsUpdate) setSheetEver(true); }, [room.needsUpdate]);

  if (!on || !remote) return null;
  const live = remote.live === true;
  if (!live && !canStart) return null;

  const onColor = variant === 'onColor';
  const viewers = Math.max(0, Number(remote.viewers) || 0);
  const starting = room.busy === 'start';
  const entering = room.busy === 'enter';

  const liveChip = (
    <View accessible accessibilityLabel={`${t('remote.live_now')} — ${t('remote.viewers', { n: formatNumber(viewers) })}`}
      style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: 9, backgroundColor: onColor ? 'rgba(255,255,255,0.18)' : colors.dangerLight }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: onColor ? '#fff' : colors.danger }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: onColor ? '#fff' : colors.dangerText }} numberOfLines={1}>{t('remote.live_now')}</Text>
      </View>
      <Icon name="eye" size={13} color={onColor ? 'rgba(255,255,255,0.85)' : colors.textSecondary} outline />
      <Text style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: onColor ? 'rgba(255,255,255,0.85)' : colors.textSecondary }} numberOfLines={1}>
        {t('remote.viewers', { n: formatNumber(viewers) })}
      </Text>
    </View>
  );

  const enterButton = (
    <Surface id="teacher.session.remote_enter" assistantNeeds="teacher">
      {/* On the gradient the button is white in both schemes, so its ink is fixed (onWhite). */}
      <TouchableOpacity onPress={room.enter} disabled={room.busy !== null} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('remote.enter')} hitSlop={4}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 42, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: onColor ? '#fff' : colors.brand, opacity: room.busy !== null && !entering ? 0.6 : 1 }}>
        {entering ? <ActivityIndicator size="small" color={onColor ? onWhite.brand : colors.onPrimary} /> : <Icon name="video" size={17} color={onColor ? onWhite.brand : colors.onPrimary} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: onColor ? onWhite.brand : colors.onPrimary }}>{t('remote.enter')}</Text>
      </TouchableOpacity>
    </Surface>
  );

  const startButton = (
    <Surface id="teacher.session.remote_start" assistantNeeds="teacher">
      <TouchableOpacity onPress={room.start} disabled={room.busy !== null} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={t('remote.start')}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: variant === 'panel' ? 48 : 42, paddingHorizontal: spacing.md, borderRadius: radius.md,
          backgroundColor: onColor ? 'rgba(255,255,255,0.16)' : variant === 'panel' ? colors.brand : colors.brandTint,
          borderWidth: onColor ? 1 : 0, borderColor: 'rgba(255,255,255,0.35)',
        }}>
        {starting
          ? <ActivityIndicator size="small" color={onColor ? '#fff' : variant === 'panel' ? colors.onPrimary : colors.brand} />
          : <Icon name="video" size={17} color={onColor ? '#fff' : variant === 'panel' ? colors.onPrimary : colors.brand} />}
        <Text style={{ fontFamily: fonts.bold, fontSize: variant === 'panel' ? 15 : 13, color: onColor ? '#fff' : variant === 'panel' ? colors.onPrimary : colors.brand }}>{t('remote.start')}</Text>
      </TouchableOpacity>
    </Surface>
  );

  const sheet = sheetEver ? <BroadcastUpdateSheet visible={room.needsUpdate} onClose={room.closeNeedsUpdate} /> : null;

  if (variant === 'panel') {
    return (
      <Surface id="teacher.session.remote" assistantNeeds="teacher">
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }, style]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="video" size={18} color={colors.brand} />
            </View>
            <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }} numberOfLines={1}>{t('remote.title')}</Text>
            <BetaChip feature={REMOTE_FLAG} style={{ alignSelf: 'center' }} />
          </View>
          {live ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {liveChip}
                {enterButton}
              </View>
              <Surface id="teacher.session.remote_end" assistantNeeds="teacher">
                <TouchableOpacity onPress={room.end} disabled={room.busy !== null} activeOpacity={0.7} accessibilityRole="button"
                  style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 36, paddingHorizontal: spacing.xs }}>
                  {room.busy === 'end' ? <ActivityIndicator size="small" color={colors.danger} /> : <Icon name="stop" size={14} color={colors.danger} />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.dangerText }}>{t('remote.end')}</Text>
                </TouchableOpacity>
              </Surface>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary }}>{t('remote.panel_sub')}</Text>
              {startButton}
            </>
          )}
        </View>
        {sheet}
      </Surface>
    );
  }

  return (
    <Surface id="teacher.session.remote" assistantNeeds="teacher">
      <View style={style}>
        {live ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {liveChip}
            {enterButton}
          </View>
        ) : startButton}
      </View>
      {sheet}
    </Surface>
  );
});

async function openFirst(urls: string[]): Promise<void> {
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      // Refused (no store app on this phone) — the next one is the web listing.
    }
  }
}

/**
 * A store build before 1.3.0 cannot broadcast (its binary has no microphone usage string, and
 * asking iOS for the microphone there kills the app). So nothing is asked and no room opens:
 * this sheet says the update is needed, and that the class can be started from the website on
 * a computer meanwhile.
 */
function BroadcastUpdateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cfg = useAppConfig();
  const links = storeLinksFor(Platform.OS, cfg.store, Constants.expoConfig?.android?.package ?? 'com.drosspot.app');
  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.md, paddingBottom: insets.bottom }}>
        <View style={{ alignSelf: 'center', width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="download" size={26} color={colors.brand} />
        </View>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 27, color: colors.textPrimary, textAlign: 'center' }}>{t('remote.update_title')}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 23, color: colors.textSecondary, textAlign: 'center' }}>{t('remote.update_body')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surfaceSunken, borderRadius: radius.lg, padding: spacing.md }}>
          <Icon name="info" size={18} color={colors.textSecondary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary }}>{t('remote.update_web')}</Text>
        </View>
        {links.length > 0 ? (
          <TouchableOpacity onPress={() => { void openFirst(links); }} activeOpacity={0.85} accessibilityRole="button"
            style={{ minHeight: 52, flexDirection: 'row', gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="download" size={18} color={colors.onPrimary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t(Platform.OS === 'ios' ? 'update.open_app_store' : 'update.open_play_store')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('remote.update_later')}</Text>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}
