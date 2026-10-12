/**
 * What the header's connection indicator shows, from what the phone knows (founder
 * 2026-10-10: «a live status of connection with a little indicator and a smart icon»).
 * Pure, so the rules are tested without a phone.
 */
export type ConnState = 'online' | 'weak' | 'offline' | 'syncing';

export interface NetSnapshot {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string; // NetInfo type: wifi | cellular | ethernet | none | unknown | …
  /** Wi-Fi strength 0–100 (Android only; null elsewhere). */
  strength?: number | null;
  /** 2g | 3g | 4g | 5g (null when unknown). */
  cellularGeneration?: string | null;
}

/** How the phone is connected — the icon follows it: Wi-Fi waves, or mobile-data bars. */
export type ConnLink = 'wifi' | 'cellular' | 'none';

export interface ConnView {
  state: ConnState;
  link: ConnLink;
  /** Signal strength 0–3: waves lit on Wi-Fi, bars on mobile data. */
  bars: 0 | 1 | 2 | 3;
}

/**
 * Offline when the phone says so. Weak when a request just went unanswered (the API client's
 * flag) or the link itself is poor (2G, a Wi-Fi under 30 %). Syncing beats both online and
 * weak while a pass is sending — the person sees their saved actions leave.
 */
export function connectionView(net: NetSnapshot, weakFlag: boolean, syncing: boolean): ConnView {
  // Offline still remembers what it was on, so the crossed-out icon is the right one.
  const link: ConnLink = net.type === 'cellular' ? 'cellular' : net.type === 'none' ? 'none' : 'wifi';
  if (net.isConnected === false || net.isInternetReachable === false || net.type === 'none') return { state: 'offline', link, bars: 0 };
  const bars = linkBars(net);
  if (syncing) return { state: 'syncing', link, bars };
  if (weakFlag || bars <= 1) return { state: 'weak', link, bars: 1 };

  return { state: 'online', link, bars };
}

function linkBars(net: NetSnapshot): 1 | 2 | 3 {
  if (net.type === 'wifi' && typeof net.strength === 'number') {
    if (net.strength >= 60) return 3;
    if (net.strength >= 30) return 2;
    return 1;
  }
  if (net.type === 'cellular') {
    switch (net.cellularGeneration) {
      case '2g': return 1;
      case '3g': return 2;
      default: return 3; // 4g, 5g, or not reported
    }
  }
  return 3;
}

/** «منذ 5 دقيقة» — the age of the last sync, in the largest whole unit. */
export function syncAge(lastSyncAt: number | null, now: number): { key: 'never' | 'just_now' | 'minutes_ago' | 'hours_ago'; n?: number } {
  if (!lastSyncAt) return { key: 'never' };
  const min = Math.floor((now - lastSyncAt) / 60_000);
  if (min < 1) return { key: 'just_now' };
  if (min < 60) return { key: 'minutes_ago', n: min };

  return { key: 'hours_ago', n: Math.floor(min / 60) };
}
