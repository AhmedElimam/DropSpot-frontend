import { useEffect } from 'react';
import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import { getShareTargets, type ShareTeacher } from '@/api/shareTargets';
import { addShareListener, getPendingShare, setShareTargets, shareSupported } from '../../modules/drosspot-share/src';
import { useIncomingShare } from '@/stores/incomingShare';
import { colors } from '@/theme/index';

export const SHARE_TARGETS_KEY = ['share-targets'] as const;

/** The teachers a receipt can go to — owed by transfer, nothing waiting for review. */
export function useShareTargets(enabled = true) {
  return useQuery({ queryKey: SHARE_TARGETS_KEY, queryFn: getShareTargets, enabled, staleTime: 5 * 60_000 });
}

/** A logo on the phone, for the share-sheet contact; null when it cannot be fetched. */
async function localLogo(t: ShareTeacher): Promise<string | null> {
  if (!t.logo_url) return null;
  try {
    // Named by the URL, so a changed logo is fetched again and an unchanged one never is.
    let h = 0;
    for (const ch of t.logo_url) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const dest = new File(Paths.cache, `share-logo-${t.teacher_id}-${(h >>> 0).toString(36)}.img`);
    if (dest.exists) return dest.uri;
    const file = await File.downloadFileAsync(t.logo_url, dest);
    return file.uri;
  } catch {
    return null;
  }
}

/**
 * «Share the receipt to the teacher» (founder 2026-11-11), the parent app's half:
 *  - keeps the phone's share sheet listing exactly the teachers the family owes by transfer
 *    (republished whenever that list changes — a paid-up teacher drops out);
 *  - when InstaPay / Vodafone Cash shared a receipt into the app (cold start or running),
 *    opens the send screen with it.
 * Does nothing on a store build without the native module (before 1.3.0).
 */
export function useParentShareInbox(enabled: boolean) {
  const targets = useShareTargets(enabled && shareSupported);
  const setShare = useIncomingShare((s) => s.set);

  useEffect(() => {
    if (!enabled || !shareSupported || !targets.data) return;
    let cancelled = false;
    (async () => {
      const list = await Promise.all(targets.data.map(async (t) => ({
        id: String(t.teacher_id),
        name: t.name ?? '',
        iconPath: await localLogo(t),
        color: colors.brand,
      })));
      if (!cancelled) await setShareTargets(list);
    })();
    return () => { cancelled = true; };
  }, [enabled, targets.data]);

  useEffect(() => {
    if (!enabled || !shareSupported) return;
    const take = async () => {
      const share = await getPendingShare();
      if (!share || (!share.file && !share.text)) return;
      setShare(share);
      router.push('/(parent)/send-receipt' as Href);
    };
    take();
    const sub = addShareListener(take);
    return () => sub.remove();
  }, [enabled, setShare]);
}
