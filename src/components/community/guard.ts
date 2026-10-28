import type { TFunction } from 'i18next';
import { Alert } from '@/ui/dialog';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { isSurfaceOn } from '@/ui/surfaces';
import { formatDateOnly } from '@/utils/format';
import { writeRefusal, type CommunityAuthor, type CommunityStanding } from '@/api/community';

/**
 * The community's guard rails, the app's half (the founder's spec, 2026-10-28). The server
 * decides everything; the app says it kindly and keeps the draft, so a refused post is a
 * rewrite, never a lost text.
 */

/**
 * A refused write, in our own popup. A nudge (a number, a link, a word, Franco or English) is
 * a friendly «rewrite it» — nothing was recorded; a suspension and a slow-down say so plainly.
 * The caller keeps the composer open with the words still in it.
 */
export function explainWriteError(err: unknown, t: TFunction): void {
  const r = writeRefusal(err);
  if (!r) { Alert.alert(t('common.error'), getFriendlyErrorMessage(err)); return; }
  const title = r.code === 'nudge' ? t('community_space.nudge_title') : r.code === 'suspended' ? t('community_space.suspended_title') : t('community_space.slow_title');
  Alert.alert(title, r.message, [{ text: t('community_space.nudge_ok') }]);
}

/**
 * Someone wrote something that reads as hurting (the spec §5.1). Their words are held from the
 * community and a person on the team is told; here they get warmth, never a violation.
 */
export function showSupport(text: string, t: TFunction): void {
  Alert.alert(t('community_space.support_title'), text, [{ text: t('community_space.nudge_ok') }]);
}

/**
 * May the viewer block this author? Members only, never their own words, never the platform's
 * team; and while the server has the `community.block` surface on (BlockedSheet declares it).
 */
export function canBlock(author: CommunityAuthor, mine: boolean, viewerWrites: boolean): boolean {
  return viewerWrites && !mine && author.role !== 'staff' && author.id > 0 && isSurfaceOn('community.block');
}

/**
 * Blocking is personal and quiet; reporting tells the platform's team. The confirm says both,
 * so the two are never mistaken for each other.
 */
export function confirmBlock(author: CommunityAuthor, t: TFunction, block: (userId: number) => Promise<unknown>): void {
  const name = author.name.split(' ')[0] || author.name;
  Alert.alert(t('community_space.block_title', { name }), t('community_space.block_body'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('community_space.block_confirm'), style: 'destructive',
      onPress: () => { block(author.id).then(() => Alert.alert('', t('community_space.blocked_done'))).catch((e) => Alert.alert('', getFriendlyErrorMessage(e))); },
    },
  ]);
}

/** «مشاركتك متوقفة حتى …» — the server's own sentence first. null while the viewer can write. */
export function pausedLine(standing: CommunityStanding | null | undefined, t: TFunction): string | null {
  if (!standing || standing.can_participate) return null;
  if (standing.message) return standing.message;
  if (standing.suspended_until && !standing.removed) return t('community_space.paused_until', { date: formatDateOnly(standing.suspended_until, { day: 'numeric', month: 'long' }) });
  return t('community_space.paused');
}
