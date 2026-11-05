/**
 * «ربط الكارت وتحضير الطالب الآن» (founder 2026-11-05): a blank «كارت المدرّس» linked from the
 * door's popup goes back to the scanner, which checks the student in through the ordinary scan
 * (session, dues, wrong group, overdue block — all of it). In memory only: a handoff the scanner
 * did not pick up within two minutes is dropped, so a stale card never checks anyone in later.
 */
const TTL_MS = 120_000;

let pending: { code: string; at: number } | null = null;

export function handBackToDoor(code: string): void {
  pending = { code, at: Date.now() };
}

/** The card to scan now, once; null when there is none or it went stale. */
export function takeDoorHandoff(): string | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < TTL_MS ? p.code : null;
}
