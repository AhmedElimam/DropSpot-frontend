import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, radius, spacing } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { SheetModal } from '@/components/ui/SheetModal';
import { usePopupSlot } from '@/ui/popupSlot';
import { useAuthStore } from '@/stores/authStore';
import { useInAppNotice } from '@/notifications/inAppNotice';
import { useCommunityStanding } from '@/hooks/useCommunity';
import { formatDate } from '@/utils/format';
import type { CommunityStandingDetail, CommunityStrike } from '@/api/community';
import { StandingSheet } from './StandingSheet';

const SEEN_KEY = 'community.pause.seen';
const SUSPENSIONS = ['suspension_short', 'suspension_long', 'severe', 'suspension_manual'];

/** The suspension or removal in force for this member now — the strike the popup is about. */
export function activePause(detail: CommunityStandingDetail | undefined, now = Date.now()): CommunityStrike | null {
  const standing = detail?.me?.standing;
  if (!standing || standing.can_participate) return null;
  const strikes = detail?.me?.strikes ?? [];
  if (standing.removed) return strikes.find((s) => s.level === 'removal' && s.appeal?.status !== 'accepted') ?? null;
  return strikes.find((s) => SUSPENSIONS.includes(s.level) && s.ends_at !== null && Date.parse(s.ends_at) > now && s.appeal?.status !== 'accepted') ?? null;
}

/**
 * «اتوقفت مشاركتك في المجتمع» wherever the member is in the app (founder 2026-10-29: «it doesn't
 * show a popup across the app for the suspended person»): once per suspension, on launch, on
 * coming back to the app, and the moment the suspension's notification lands. Says until when,
 * why, that reading and the rest of the app carry on, and offers the appeal. Private: only the
 * member themself — parents hear through their own notification.
 *
 * Mounted once at the root; one popup at a time through the popup slot.
 */
export function CommunityPauseNotice() {
  const role = useAuthStore((s) => s.role);
  const member = role === 'student' || role === 'parent';
  const standing = useCommunityStanding(member);
  const qc = useQueryClient();
  const [seen, setSeen] = useState<number[] | null>(null);
  const [appealOpen, setAppealOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(SEEN_KEY).then((raw) => { if (alive) setSeen(raw ? (JSON.parse(raw) as number[]) : []); }).catch(() => { if (alive) setSeen([]); });
    return () => { alive = false; };
  }, []);

  // The suspension's own notification, while the app is open: ask again straight away.
  const noticeType = useInAppNotice((s) => s.notice?.type ?? null);
  const noticeKey = useInAppNotice((s) => s.notice?.key ?? null);
  useEffect(() => {
    if (member && noticeType === 'community_strike') void qc.invalidateQueries({ queryKey: ['community', 'standing'] });
  }, [member, noticeType, noticeKey, qc]);

  const pause = useMemo(() => activePause(standing.data), [standing.data]);
  const wants = member && seen !== null && pause !== null && !seen.includes(pause.id);
  const show = usePopupSlot('community_pause', wants);

  const close = () => {
    if (!pause) return;
    const next = [...(seen ?? []), pause.id].slice(-20);
    setSeen(next);
    void AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next)).catch(() => {});
  };

  return (
    <>
      {show && pause ? (
        <Notice
          pause={pause}
          message={standing.data?.me?.standing?.message ?? null}
          onClose={close}
          onAppeal={() => { close(); setTimeout(() => setAppealOpen(true), 320); }}
        />
      ) : null}
      <StandingSheet visible={appealOpen} parent={role === 'parent'} onClose={() => setAppealOpen(false)} />
    </>
  );
}

function Notice({ pause, message, onClose, onAppeal }: { pause: CommunityStrike; message: string | null; onClose: () => void; onAppeal: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const removed = pause.level === 'removal';
  const until = pause.ends_at ? formatDate(pause.ends_at) : null;
  return (
    <SheetModal visible onClose={onClose} style={{ backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }}>
      <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pause" size={30} color={colors.warning} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
          {t(removed ? 'community_space.pause_popup_removed_title' : 'community_space.pause_popup_title')}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 24, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
          {message ?? (until ? t('community_space.paused_until', { date: until }) : t('community_space.paused'))}
        </Text>
      </View>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Row icon="flag" text={t('community_space.pause_popup_reason', { reason: pause.reason_label })} />
        {until && !removed ? <Row icon="calendar" text={t('community_space.pause_popup_until', { date: until })} /> : null}
        <Row icon="success" text={t('community_space.pause_popup_school')} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        {pause.can_appeal ? (
          <TouchableOpacity onPress={onAppeal} activeOpacity={0.85} accessibilityRole="button"
            style={{ flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('community_space.pause_popup_appeal')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onClose} activeOpacity={0.85} accessibilityRole="button"
          style={{ flex: 1, height: 50, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onPrimary }}>{t('community_space.pause_popup_ok')}</Text>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}

function Row({ icon, text }: { icon: 'flag' | 'calendar' | 'success'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken }}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.textPrimary }}>{text}</Text>
    </View>
  );
}
