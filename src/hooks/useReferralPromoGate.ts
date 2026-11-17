import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePromoStamp, promoDue, promoKey } from '@/components/referral/promoGate';

/**
 * Whether the weekly «ادعُ معلّمًا» reminder is due for this account on this phone: `undefined`
 * while the stamp is read, then a decision that holds for this opening of the app. `markShown`
 * writes today's stamp as the reminder comes up (so a phone killed while it shows still counts
 * the week) without flipping `due` — the popup closes by its own buttons, not under the teacher.
 */
export function useReferralPromoGate(userId: number | null) {
  const [due, setDue] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (userId === null) { setDue(undefined); return; }
    let live = true;
    setDue(undefined);
    AsyncStorage.getItem(promoKey(userId))
      .then((v) => { if (live) setDue(promoDue(parsePromoStamp(v), Date.now())); })
      // Unreadable storage: stay quiet rather than risk showing it on every opening.
      .catch(() => { if (live) setDue(false); });
    return () => { live = false; };
  }, [userId]);

  const markShown = useCallback(() => {
    if (userId === null) return;
    AsyncStorage.setItem(promoKey(userId), String(Date.now())).catch(() => {});
  }, [userId]);

  return { due, markShown };
}
