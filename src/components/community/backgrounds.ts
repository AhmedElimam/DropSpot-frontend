import type { CommunityBackground } from '@/api/community';

/**
 * The colours a short text-only post may sit on (founder 2026-10-28: «editing tools like
 * Facebook»). The server keeps only the name and drops it from text past BACKGROUND_MAX_CHARS
 * or a post with a picture; the app draws it. Each is a diagonal gradient with white text,
 * readable in both schemes.
 */
export const BACKGROUND_MAX_CHARS = 130;

export const BACKGROUNDS: Record<CommunityBackground, { colors: [string, string]; text: string }> = {
  indigo: { colors: ['#4A58D8', '#26307E'], text: '#FFFFFF' },
  sunset: { colors: ['#FF8A5C', '#E2366A'], text: '#FFFFFF' },
  mint: { colors: ['#2EC4A0', '#0E7C6B'], text: '#FFFFFF' },
  rose: { colors: ['#F772B6', '#A63BD6'], text: '#FFFFFF' },
  night: { colors: ['#1F2A44', '#0B1020'], text: '#FFFFFF' },
  sky: { colors: ['#4FB3F6', '#2563EB'], text: '#FFFFFF' },
};

export const BACKGROUND_KEYS = Object.keys(BACKGROUNDS) as CommunityBackground[];

/** May this text sit on a colour? Short, one paragraph, no picture. */
export function fitsBackground(body: string, pictures: number): boolean {
  const t = body.trim();
  return pictures === 0 && t.length > 0 && t.length <= BACKGROUND_MAX_CHARS && !t.includes('\n\n');
}
