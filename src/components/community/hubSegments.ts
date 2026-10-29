import type { IconName } from '@/components/ui/Icon';
import type { SegmentItem } from '@/components/threads/Segments';

export type HubSegment = 'community' | 'chat' | 'threads';
export const HUB_SEGMENTS: HubSegment[] = ['community', 'chat', 'threads'];

/** Which hub segments are on, in their fixed order: the community leads, then chat, then حكاوي. */
export function enabledSegments(on: { community: boolean; chat: boolean; threads: boolean }): HubSegment[] {
  return HUB_SEGMENTS.filter((s) => on[s]);
}

/** The segment control's items for the hub screens (student, parent, teacher). مجتمعنا wears the brand mark. */
export function hubSegmentItems(enabled: HubSegment[], labels: Record<HubSegment, string>, badges: Record<HubSegment, number>): SegmentItem<HubSegment>[] {
  const icon: Record<HubSegment, IconName> = { community: 'people', chat: 'chat', threads: 'threads' };
  return enabled.map((s) => ({ key: s, label: labels[s], icon: icon[s], badge: badges[s], logo: s === 'community' }));
}
