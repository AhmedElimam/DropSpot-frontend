/**
 * Links in a message, the way the server finds them (ChatMessage::LINK_PATTERN): http(s)://…
 * or www.… up to the next space. What the «الروابط» tab lists is exactly what a bubble
 * underlines. Trailing punctuation stays text: «شوفوا www.x.com.» links www.x.com.
 */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"']+/giu;
const TRAILING = /[.,!?;:،؛)\]}»]+$/u;

export type LinkSegment = { text: string; url?: string };

export function linkify(text: string): LinkSegment[] {
  const out: LinkSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    const start = m.index ?? 0;
    let raw = m[0];
    const tail = raw.match(TRAILING)?.[0] ?? '';
    if (tail) raw = raw.slice(0, raw.length - tail.length);
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: raw, url: hrefOf(raw) });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text }];
}

/** What to open: www.… gets https://. */
export function hrefOf(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** «drosspot.app» from a link, for the links tab's heading. */
export function domainOf(raw: string): string {
  const m = hrefOf(raw).match(/^https?:\/\/([^/?#]+)/i);
  return (m?.[1] ?? raw).replace(/^www\./i, '');
}

export function firstLink(text: string | null | undefined): string | null {
  if (!text) return null;
  return linkify(text).find((s) => s.url)?.text ?? null;
}

/**
 * Open a link in the in-app browser. Loaded on tap, not at import: the browser module pulls
 * in native code a test (or an older binary) may not have; the system browser is the fallback.
 */
export function openLink(raw: string): void {
  const url = hrefOf(raw);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WebBrowser = require('expo-web-browser') as typeof import('expo-web-browser');
    void WebBrowser.openBrowserAsync(url).catch(() => undefined);
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Linking } = require('react-native') as typeof import('react-native');
    void Linking.openURL(url).catch(() => undefined);
  }
}
