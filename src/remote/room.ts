import { isVersionBelow } from '@/utils/semver';

/**
 * «حصة أونلاين» — the decisions of the live room, kept pure (no React, no native module) so
 * each one is tested on its own: what a message from the page means, where the page may
 * navigate, which build may broadcast, and when a room left in the background is dropped.
 *
 * The room itself is a web page served by our backend (LiveKit inside it, our own UI). The
 * app opens a one-time `join_url` in a full-screen WebView and listens; nothing else.
 */

/** The room is night in both schemes (the dark palette's canvas): video reads on it, and nothing flashes white. */
export const ROOM_BACKGROUND = '#080E26';

/** The push / feed type sent to the students and their parents when a class goes on air. */
export const REMOTE_LIVE_NOTIFICATION = 'remote_session_live';

// ── Messages from the page ────────────────────────────────────────────────────────────────

/** What the page says with `window.ReactNativeWebView.postMessage(JSON.stringify({ type }))`. */
export type RoomMessageType = 'ready' | 'leave' | 'ended' | 'checked_in';

/**
 * What the screen does about it:
 *  · ready      — the page loaded and connected: lift the loading cover;
 *  · close      — the person pressed leave inside the page: close the screen, no question;
 *  · ended      — the teacher ended the class: close the screen and say so;
 *  · checked_in — the student's attendance was just recorded: refresh the session cards.
 */
export type RoomAction =
  | { kind: 'ready' }
  | { kind: 'close' }
  | { kind: 'ended' }
  | { kind: 'checked_in' };

const ACTIONS: Record<RoomMessageType, RoomAction> = {
  ready: { kind: 'ready' },
  leave: { kind: 'close' },
  ended: { kind: 'ended' },
  checked_in: { kind: 'checked_in' },
};

/** Longest message the page has any reason to send; anything bigger is not ours. */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * A raw `postMessage` string → the action, or null for anything that is not one of ours
 * (not JSON, no `type`, a type this build does not know). Never throws: the page is a web
 * page, and a newer one may say things an older app has not learned.
 */
export function roomActionFor(raw: unknown): RoomAction | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_MESSAGE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const type = (parsed as { type?: unknown }).type;
  if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(ACTIONS, type)) return null;
  return ACTIONS[type as RoomMessageType];
}

// ── Where the page may go ─────────────────────────────────────────────────────────────────

const DEFAULT_PORT: Record<string, string> = { https: '443', http: '80' };

/**
 * `scheme://host[:port]` of an http(s) address, lower-cased, a default port dropped — or null
 * when the address is anything else. Written by hand on purpose: Hermes' `URL` is partial,
 * and a guard must not depend on how a parser forgives. Refused outright: any other scheme,
 * a user-info part (`https://ours@evil.example`), a backslash or a control character in the
 * authority (browsers read `\` as `/`), an empty or malformed host or port.
 */
export function originOf(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const m = /^(https?):\/\/([^/?#]*)/i.exec(url);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  // The authority is everything up to the first `/`, `?` or `#`. Only a plain host (letters,
  // digits, dots, hyphens, or a bracketed IPv6) and an optional port pass — so `@`, `\`,
  // spaces and control characters are refused by construction, not by a list of bad ones.
  const hp = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(m[2]);
  if (!hp) return null;
  const host = hp[1].toLowerCase();
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null;
  const portNumber = hp[2] === undefined ? null : Number(hp[2]);
  if (portNumber !== null && (portNumber < 1 || portNumber > 65535)) return null;
  const port = portNumber !== null && String(portNumber) !== DEFAULT_PORT[scheme] ? `:${portNumber}` : '';
  return `${scheme}://${host}${port}`;
}

/**
 * May the WebView load `url`, given the `joinUrl` it was opened with? Only the same origin —
 * scheme, host and port. Every frame, every redirect, every `window.open`: the page must never
 * be able to take the WebView (which is allowed the camera and the microphone) anywhere else.
 * `about:blank` is the empty document a page may create for itself; it carries the creator's
 * origin and loads nothing.
 */
export function isAllowedNavigation(url: unknown, joinUrl: unknown): boolean {
  if (url === 'about:blank' || url === 'about:srcdoc') return true;
  const home = originOf(joinUrl);
  return home !== null && originOf(url) === home;
}

/**
 * Is this `join_url` ours to open at all? It must sit on the very origin the app's API
 * answers from (the contract: «an https URL on our own API host»). So a production build
 * only ever opens https on drosspot.app, a staging build on stg.drosspot.app, and the staging
 * key header is never sent anywhere else.
 */
export function isTrustedJoinUrl(joinUrl: unknown, apiBaseUrl: unknown): boolean {
  const api = originOf(apiBaseUrl);
  return api !== null && originOf(joinUrl) === api;
}

// ── Who may broadcast from the phone ──────────────────────────────────────────────────────

/**
 * The first store build whose binary carries the microphone usage string. Asking iOS for the
 * microphone on an older binary kills the app, so those builds never open the broadcaster.
 */
export const MIN_BROADCAST_VERSION = '1.3.0';

/** May THIS binary broadcast (camera + microphone)? Students only watch and are never gated. */
export function canBroadcastFromPhone(binaryVersion: string): boolean {
  return !isVersionBelow(binaryVersion, MIN_BROADCAST_VERSION);
}

/**
 * What the WebView answers when the PAGE asks for the camera or the microphone (iOS,
 * `mediaCapturePermissionGrantType`). On a binary that may broadcast: granted — it is our own
 * page on our own origin, and the system still asks the person once. On an older binary:
 * denied inside the WebView, for everyone, so no request ever reaches a system that has no
 * usage string to show — whatever the page does (a student allowed to speak included).
 */
export function mediaCaptureGrantFor(binaryVersion: string): 'grant' | 'deny' {
  return canBroadcastFromPhone(binaryVersion) ? 'grant' : 'deny';
}

// ── A room left in the background ─────────────────────────────────────────────────────────

/**
 * How long the app may sit in the background before the room is dropped (the WebView
 * unmounted: the stream, the camera and the microphone stop). Long enough for a permission
 * question or a glance at a message; short enough that nothing keeps running in a pocket.
 */
export const ROOM_BACKGROUND_GRACE_MS = 20_000;

/** Back in front after `awayMs`: is the room gone (open a fresh one) or still the same? */
export function roomDroppedAfter(awayMs: number): boolean {
  return awayMs >= ROOM_BACKGROUND_GRACE_MS;
}

// ── The link that «start» returns ─────────────────────────────────────────────────────────

/**
 * `POST …/remote/start` answers with the teacher's `join_url` already. It is handed to the
 * room screen through here — in memory, taken once, never stored, never a route param — so
 * starting a class does not cost a second request. A link is good for ~2 minutes on the
 * server; one older than a minute here is thrown away and the screen asks for a new one.
 */
export const HANDOFF_MAX_AGE_MS = 60_000;

let handoff: { key: string; url: string; at: number } | null = null;

export function offerJoinUrl(key: string, url: string, now: number = Date.now()): void {
  handoff = { key, url, at: now };
}

/** The link offered for `key`, once. Any call empties the slot — a link is never used twice. */
export function takeJoinUrl(key: string, now: number = Date.now()): string | null {
  const h = handoff;
  handoff = null;
  if (!h || h.key !== key) return null;
  const age = now - h.at;
  return age >= 0 && age < HANDOFF_MAX_AGE_MS ? h.url : null;
}

// ── Which sessions show the entry points ──────────────────────────────────────────────────

/** A session row's `remote` field: absent/null = the feature is off for that teacher. */
export interface RemoteFlag {
  live: boolean;
  /** Teacher rows only. */
  viewers?: number;
}

/** Is the class on air? (False for an older server, a teacher without the feature, a class not started.) */
export function isRemoteLive(remote: RemoteFlag | null | undefined): boolean {
  return !!remote && remote.live === true;
}

/** The same calendar day on this phone — «ابدأ حصة أونلاين» is offered for today's sessions only. */
export function isSameLocalDay(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const n = new Date(now);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
