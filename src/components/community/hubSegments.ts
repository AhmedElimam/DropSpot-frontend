import type { IconName } from '@/components/ui/Icon';
import type { SegmentItem } from '@/components/threads/Segments';

export type HubSegment = 'community' | 'chat' | 'threads';
export const HUB_SEGMENTS: HubSegment[] = ['community', 'chat', 'threads'];

/** Each side is a surface backend code can hide (config/mobile_ui.php `hidden`), flag or no flag. */
export const HUB_SEGMENT_SURFACES: Record<HubSegment, { surface: string }> = {
  community: { surface: 'hub.segment.community' },
  chat: { surface: 'hub.segment.chat' },
  threads: { surface: 'hub.segment.threads' },
};

/** Which hub segments are on, in their fixed order: the community leads, then chat, then حكاوي. */
export function enabledSegments(on: { community: boolean; chat: boolean; threads: boolean }, hidden?: ReadonlySet<string>): HubSegment[] {
  return HUB_SEGMENTS.filter((s) => on[s] && !hidden?.has(HUB_SEGMENT_SURFACES[s].surface));
}

/** The segment control's items for the hub screens (student, parent, teacher). مجتمعنا wears the brand mark. */
export function hubSegmentItems(enabled: HubSegment[], labels: Record<HubSegment, string>, badges: Record<HubSegment, number>): SegmentItem<HubSegment>[] {
  const icon: Record<HubSegment, IconName> = { community: 'people', chat: 'chat', threads: 'threads' };
  return enabled.map((s) => ({ key: s, label: labels[s], icon: icon[s], badge: badges[s], logo: s === 'community' }));
}
