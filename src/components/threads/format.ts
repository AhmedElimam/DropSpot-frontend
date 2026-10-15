import type { Thread } from '@/api/threads';

/**
 * حكاوي — the pure half of the feature's look: which state a post is in, how the clock reads,
 * how long ago, and whose initials go in the disc. No React, no tokens, so it is all testable
 * and the cards can call it per render without cost.
 */

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Western digits → Arabic-Indic, display only (never for inputs or codes). */
export function arDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/** The timer presets a teacher actually reaches for, in minutes; 0 = no timer. */
export const TIMER_PRESETS: { minutes: number; key: string }[] = [
  { minutes: 15, key: 'threads.timer_15m' },
  { minutes: 60, key: 'threads.timer_1h' },
  { minutes: 360, key: 'threads.timer_6h' },
  { minutes: 1440, key: 'threads.timer_1d' },
  { minutes: 4320, key: 'threads.timer_3d' },
  { minutes: 10080, key: 'threads.timer_1w' },
  { minutes: 0, key: 'threads.timer_none' },
];

export type ThreadState = 'open' | 'timer' | 'locked' | 'answered' | 'note';

export function stateOf(t: Pick<Thread, 'kind' | 'answered_at' | 'open' | 'closed_reason'>): ThreadState {
  if (t.kind !== 'question') return 'note';
  if (t.answered_at) return 'answered';
  if (t.open) return 'open';
  return t.closed_reason === 'locked' ? 'locked' : 'timer';
}

/** The feed's filter chips. `waiting` = the round is over and the teacher has not answered. */
export type ThreadFilter = 'all' | 'open' | 'waiting' | 'answered' | 'notes';

export function matchesFilter(state: ThreadState, filter: ThreadFilter): boolean {
  switch (filter) {
    case 'open': return state === 'open';
    case 'waiting': return state === 'timer' || state === 'locked';
    case 'answered': return state === 'answered';
    case 'notes': return state === 'note';
    default: return true;
  }
}

export function filterCounts(threads: Pick<Thread, 'kind' | 'answered_at' | 'open' | 'closed_reason'>[]): Record<ThreadFilter, number> {
  const out: Record<ThreadFilter, number> = { all: threads.length, open: 0, waiting: 0, answered: 0, notes: 0 };
  for (const t of threads) {
    const s = stateOf(t);
    if (s === 'open') out.open++;
    else if (s === 'timer' || s === 'locked') out.waiting++;
    else if (s === 'answered') out.answered++;
    else out.notes++;
  }
  return out;
}

export function secondsUntil(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
}

/**
 * How often the clock needs to move for a given distance from zero: every second only in
 * the last hour (where mm:ss is shown), every half minute within the day, every few minutes
 * beyond. The countdowns round to this, so a card several hours from closing re-renders a
 * handful of times an hour instead of every second.
 */
export function tickFor(secondsLeft: number): number {
  if (secondsLeft <= 3600) return 1;
  if (secondsLeft <= 86400) return 30;
  return 300;
}

/** Seconds left rounded UP to the tick, so a label never claims less time than there is. */
export function quantize(secondsLeft: number): number {
  const step = tickFor(secondsLeft);
  return step === 1 ? secondsLeft : Math.ceil(secondsLeft / step) * step;
}

// Egyptian counting: «ساعة / ساعتين / ٣ ساعات / ١١ ساعة».
type Unit = readonly [one: string, two: string, few: string, many: string];
const DAY: Unit = ['يوم', 'يومين', 'أيام', 'يوم'];
const HOUR: Unit = ['ساعة', 'ساعتين', 'ساعات', 'ساعة'];
const MINUTE: Unit = ['دقيقة', 'دقيقتين', 'دقايق', 'دقيقة'];

export function countOf(n: number, unit: Unit): string {
  if (n === 1) return unit[0];
  if (n === 2) return unit[1];
  if (n >= 3 && n <= 10) return `${arDigits(n)} ${unit[2]}`;
  return `${arDigits(n)} ${unit[3]}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * The clock in words: «٣ أيام», «يوم و٥ ساعات», «ساعتين و١٠ دقايق», «٤٥ دقيقة», and in the
 * last ten minutes a ticking «٠٩:٤١». The caller adds «فاضل».
 */
export function humanLeft(s: number): string {
  if (s <= 0) return arDigits('00:00');
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d >= 3) return countOf(d, DAY);
  if (d >= 1) return h > 0 ? `${countOf(d, DAY)} و${countOf(h, HOUR)}` : countOf(d, DAY);
  if (h >= 3) return countOf(h, HOUR);
  if (h >= 1) return m > 0 ? `${countOf(h, HOUR)} و${countOf(m, MINUTE)}` : countOf(h, HOUR);
  if (s >= 600) return countOf(m, MINUTE);
  return arDigits(`${pad2(m)}:${pad2(s % 60)}`);
}

/** The ring's big figure and the small unit under it. */
export function ringParts(s: number): { value: string; unit: string } {
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60);
  if (d >= 1) return { value: arDigits(d), unit: d === 1 ? 'يوم' : d === 2 ? 'يومين' : d <= 10 ? 'أيام' : 'يوم' };
  if (h >= 1) return { value: arDigits(h), unit: h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? 'ساعات' : 'ساعة' };
  if (s >= 600) return { value: arDigits(m), unit: 'دقيقة' };
  return { value: arDigits(`${pad2(m)}:${pad2(s % 60)}`), unit: 'دقيقة' };
}

/** Share of the round still left (1 → 0), measured from the post's creation. */
export function fractionLeft(createdAt: string, endsAt: string, now = Date.now()): number {
  const start = new Date(createdAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!(end > start)) return 0;
  return Math.min(1, Math.max(0, (end - now) / (end - start)));
}

/** «دلوقتي», «من ٥ د», «من ٣ س», «امبارح», «من ٤ أيام», then a short date. */
export function ago(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (mins < 1) return 'دلوقتي';
  if (mins < 60) return `من ${arDigits(mins)} د`;
  if (hrs < 24) return `من ${arDigits(hrs)} س`;
  if (days === 1) return 'امبارح';
  if (days < 7) return `من ${countOf(days, DAY)}`;
  if (days < 30) return `من ${arDigits(Math.floor(days / 7))} أسبوع`;
  const d = new Date(iso);
  return arDigits(`${d.getDate()}/${d.getMonth() + 1}`);
}

const HONORIFICS = /^(أ\.|أ\/|ا\/|أ|م\.|م\/|د\.|د\/|مستر|مس|ميس|الأستاذ|الاستاذ|الأستاذة|الاستاذة|أستاذ|استاذ|أستاذة|استاذة|Mr\.?|Mrs\.?|Ms\.?|Dr\.?)$/i;

/**
 * Up to two initials for the disc. Titles («مستر», «أ/») are skipped. Arabic letters join, so
 * the two are held apart by a zero-width non-joiner — «م‌ع», not a ligature that reads as a word.
 */
export function initials(name: string | null | undefined): string {
  const words = String(name ?? '').trim().split(/\s+/).filter((w) => w && !HONORIFICS.test(w));
  if (!words.length) return '؟';
  const first = Array.from(words[0])[0] ?? '';
  const second = words.length > 1 ? Array.from(words[1])[0] ?? '' : '';
  if (!second) return first.toUpperCase();
  const latin = /[A-Za-z]/.test(first + second);
  return latin ? (first + second).toUpperCase() : `${first}‌${second}`;
}
