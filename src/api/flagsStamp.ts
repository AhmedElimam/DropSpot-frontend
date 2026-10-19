/**
 * `X-Flags-State` — a short hash of the server's feature switchboard, on every signed-in
 * API response (backend FeatureFlag::stateStamp). When it moves, a flag was flipped in
 * /ops: the config sync refetches /app-config at once instead of waiting for its
 * five-minute foreground gap (founder 2026-10-19: «activated chats for a teacher and
 * didn't show»). The first stamp of a run is only remembered — the start-up sync already
 * fetched the config it describes.
 *
 * No imports on purpose: the API client feeds it and the config sync listens, and neither
 * may import the other.
 */
let last: string | null = null;
let listener: (() => void) | null = null;

export function noteFlagsStamp(value: unknown): void {
  if (typeof value !== 'string' || value === '') return;
  const previous = last;
  last = value;
  if (previous !== null && previous !== value) listener?.();
}

export function onFlagsStampChange(fn: (() => void) | null): void {
  listener = fn;
}

/** Sign-out / tests: the next person's first stamp is a first stamp again. */
export function resetFlagsStamp(): void {
  last = null;
}
