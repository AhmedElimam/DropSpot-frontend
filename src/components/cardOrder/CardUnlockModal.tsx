import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppModal as Modal } from '@/ui/AppModal';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { useAuthStore } from '@/stores/authStore';
import { useTourStore } from '@/tour/store';
import { getTourStatus } from '@/api/tour';
import { usePopupSlot } from '@/ui/popupSlot';
import { NazerFace } from '@/components/nazer/NazerFace';
import { BLOCKING_PREFIXES } from '@/components/nazer/NazerUnlockModal';
import { RiseIn } from '@/components/nazer/NazerUnlockStage';
import { useReducedMotion } from 'react-native-reanimated';
import { formatNumber } from '@/utils/format';
import { useCardUnlock } from './cardUnlock';
import { CardUnlockStage } from './CardUnlockStage';
import { CardUnlockShow, type CardRect } from './CardUnlockShow';
import { prefetchCardFaces } from './DsCard3D';

const KEY = 'card_unlocked';
const LOGO = 64;

/**
 * «مستوى جديد — الكارت اتفتح» (founder 2026-11-07): the first time a child has two teachers on
 * Dros Spot (and no card or order yet), الناظر unlocks the Dros Spot card for them like a game's
 * new item — once per child, per account on this phone. It waits for his own introduction, the
 * first tour and any other popup (src/ui/popupSlot.ts); its button opens the order form.
 */
export function CardUnlockModal() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const impersonating = useAuthStore((s) => !!s.impersonation?.active);
  const { family, orderable } = useCardUnlock();
  const key = user ? `${KEY}:${user.id}` : null;
  const [seen, setSeen] = useState<number[] | undefined>(undefined);

  useEffect(() => {
    if (!key || !family) return;
    setSeen(undefined);
    AsyncStorage.getItem(key)
      .then((v) => { try { const ids = JSON.parse(v ?? '[]'); setSeen(Array.isArray(ids) ? ids.map(Number) : []); } catch { setSeen([]); } })
      .catch(() => setSeen(undefined));
  }, [key, family]);

  const fresh = useMemo(() => (seen ? orderable.filter((c) => !seen.includes(c.student_id)) : []), [orderable, seen]);
  const { data: tour } = useQuery({ queryKey: ['tour-status', user?.id], queryFn: getTourStatus, enabled: !!user && family && fresh.length > 0, staleTime: 5 * 60_000 });
  const touring = useTourStore((s) => s.tour !== null);
  const pathname = usePathname() ?? '';
  const blocked = BLOCKING_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => { if (fresh.length > 0) prefetchCardFaces(); }, [fresh.length]);

  // A system close (Android's back, iOS handing one modal to the next) only puts it away for this
  // session; it counts as seen only when one of its own buttons is pressed.
  const [putAway, setPutAway] = useState(false);
  const visible = usePopupSlot('card_unlock', family && fresh.length > 0 && !!tour?.completed && !touring && !blocked && !impersonating && !putAway);
  // Locked in the popup → a tap opens the full-screen show → it closes up onto the popup's card.
  const still = useReducedMotion();
  const [show, setShow] = useState<{ from: CardRect | null } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const measureCard = useRef<(() => Promise<CardRect | null>) | null>(null);
  useEffect(() => { if (!visible) { setShow(null); setRevealed(false); } }, [visible]);
  const open = (from: CardRect | null) => { if (still) setRevealed(true); else setShow({ from }); };

  const done = () => {
    const ids = [...(seen ?? []), ...fresh.map((c) => c.student_id)];
    setSeen(ids);
    if (key) AsyncStorage.setItem(key, JSON.stringify(ids)).catch(() => {});
  };
  if (!family) return null;

  const parent = role === 'parent';
  const first = fresh[0];
  const names = fresh.map((c) => c.name.split(' ')[0]).join(' و');
  const hello = parent
    ? t('card_unlock.parent_hello', { name: names, n: formatNumber(first?.teacher_count ?? 2) })
    : t('card_unlock.student_hello', { n: formatNumber(first?.teacher_count ?? 2) });
  const who = parent ? 'parent' : 'student';
  const points = [1, 2, 3].map((n) => t(`card_unlock.${who}_${n}`));
  const order = () => { done(); router.push((parent ? '/(parent)/order-card' : '/(student)/order-card') as Href); };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={() => { if (!show) setPutAway(true); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.6)', justifyContent: 'center', padding: spacing.lg }}>
        <View style={{ paddingTop: LOGO / 2 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.xxl, overflow: 'hidden', ...shadows.md }}>
          <CardUnlockStage play={visible} revealed={revealed} hideCard={!!show} onOpen={open} measureRef={measureCard} />

          <RiseIn show={revealed}>
          <View style={{ padding: spacing.lg }}>
            {/* الناظر hands it over, in his own words. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <NazerFace size={56} mood="proud" />
              <View style={{ flex: 1, backgroundColor: colors.brandTint, borderRadius: radius.lg, padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 23, color: colors.textPrimary }}>{hello}</Text>
              </View>
            </View>
            <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
              {points.map((p) => (
                <View key={p} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Icon name="success" size={13} color={colors.brand} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary }}>{p}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={order} activeOpacity={0.85} accessibilityRole="button"
              style={{ marginTop: spacing.lg, minHeight: 52, borderRadius: radius.lg, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
              <Icon name="card" size={18} color={colors.onPrimary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.onPrimary }}>{t('card_unlock.order')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={done} activeOpacity={0.7} accessibilityRole="button" style={{ alignSelf: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.xl }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.textSecondary }}>{t('card_unlock.later')}</Text>
            </TouchableOpacity>
          </View>
          </RiseIn>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ width: LOGO, height: LOGO, borderRadius: LOGO / 2, backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.background, alignItems: 'center', justifyContent: 'center', ...shadows.sm }}>
            <BrandMark size={32} />
          </View>
        </View>
        </View>
        {show ? (
          <CardUnlockShow from={show.from} target={() => measureCard.current?.() ?? Promise.resolve(null)}
            onCollapse={() => setRevealed(true)} onLanded={() => setShow(null)} />
        ) : null}
      </View>
    </Modal>
  );
}
