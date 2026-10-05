const LOCALE = 'ar-EG';

// The platform operates in Africa/Cairo (the server's timezone). Every displayed
// time/date is pinned to it so a teacher whose phone is set to another timezone
// still sees the real session time — the screen is what they act on at the door.
// This is correctness, not cosmetics. Always format through these helpers.
const TZ = 'Africa/Cairo';

/** Merge caller options over the Cairo-pinned base (never let a caller drop the tz). */
function opts(base: Intl.DateTimeFormatOptions, extra?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return { timeZone: TZ, ...base, ...extra };
}

// Every `d.toLocaleDateString(locale, options)` call BUILDS A NEW FORMATTER inside the
// engine: on Hermes/Android that means crossing into the platform's ICU and loading
// Arabic locale data, and it is one of the most expensive operations available to us.
// These helpers are called per ROW, per RENDER (a session list, an attendance history,
// a notification feed), so the cost scaled with list length and re-render count and
// showed up as scroll jank and heat on mid-range chips (Redmi Note 11S, 2026-09-22).
// A formatter is immutable and reusable, so we build each shape once and keep it.
// Same output, same timezone pinning — only the construction is amortised.
const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(o: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(o);
  let f = dtfCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, o);
    dtfCache.set(key, f);
  }
  return f;
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(o?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = o ? JSON.stringify(o) : '';
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, o);
    nfCache.set(key, f);
  }
  return f;
}

const toDate = (date: string | Date): Date => (typeof date === 'string' ? new Date(date) : date);

const TIME_OPTS = opts({ hour: '2-digit', minute: '2-digit', hour12: true });
export function formatTime(date: string | Date): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return '';
  return dtf(TIME_OPTS).format(d);
}

const DATE_OPTS = opts({ weekday: 'long', day: 'numeric', month: 'long' });
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return '';
  return dtf(options ? opts({ weekday: 'long', day: 'numeric', month: 'long' }, options) : DATE_OPTS).format(d);
}

const SHORT_DATE_OPTS = opts({ weekday: 'short', day: 'numeric', month: 'short' });
export function formatShortDate(date: string | Date): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return '';
  return dtf(SHORT_DATE_OPTS).format(d);
}

// Combined date + 12h time, e.g. "١٢ أغسطس ٤:٣٠ م". For rows that need both
// (payment proofs, oversight, booking requests). Options override the date part.
const DATETIME_OPTS = opts({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
export function formatDateTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return '';
  return dtf(options ? opts({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }, options) : DATETIME_OPTS).format(d);
}

/** Arabic-Indic number formatting — the ONE place numerals are localised. */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return nf(options).format(value);
}

// Full day + date, e.g. "الاثنين ١٢ أغسطس". Used wherever a session/attendance
// row needs its calendar day spelled out.
export function formatDayDate(date: string | Date): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return '';
  return dtf(DATE_OPTS).format(d);
}

// A relative day word (اليوم / أمس / غدًا) when the date is within ±1 day of now,
// else null. Callers fall back to formatDayDate for anything further out.
export function relativeDay(date: string | Date): string | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(d) - startOf(new Date())) / 86_400_000);
  if (diff === 0) return 'اليوم';
  if (diff === -1) return 'أمس';
  if (diff === 1) return 'غدًا';
  return null;
}

/** Whole days from today until `date` (day-granular; past → negative, today → 0). */
export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 0;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOf(d) - startOf(new Date())) / 86_400_000);
}

// The label a session/date row shows: a relative word when close, else the full
// day + date. Optionally appends the full date after the relative word.
export function dayLabel(date: string | Date | null): string {
  if (!date) return '';
  const rel = relativeDay(date);
  const full = formatDayDate(date);
  return rel ? `${rel} · ${full}` : full;
}

export function formatTimeRange(start: string | Date, end: string | Date): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) { return `${m} د`; }
  if (m === 0) { return `${h} س`; }
  return `${h} س ${m} د`;
}

export function getGreetingKey(): string {
  const h = new Date().getHours();
  return h < 12 ? 'common.morning_greeting' : 'common.afternoon_greeting';
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const TIMEAGO_FALLBACK_OPTS = opts({ day: 'numeric', month: 'short' });
export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (seconds < 60) return 'الآن';
  if (mins === 1) return 'منذ دقيقة';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  if (hrs === 1) return 'منذ ساعة';
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  if (days === 1) return 'أمس';
  if (days < 7) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${Math.floor(days / 7)} أسبوع`;
  return dtf(TIMEAGO_FALLBACK_OPTS).format(d);
}

export type TimeFilter = 'all' | 'today' | 'week' | 'month';

export function filterByTime<T extends { created_at?: string }>(
  items: T[],
  filter: TimeFilter,
): T[] {
  if (filter === 'all') return items;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return items.filter((item) => {
    if (!item.created_at) return true;
    const d = new Date(item.created_at);
    if (filter === 'today') return d >= startOfDay;
    if (filter === 'week') {
      const weekAgo = new Date(startOfDay.getTime() - 7 * 86400000);
      return d >= weekAgo;
    }
    if (filter === 'month') {
      const monthAgo = new Date(startOfDay.getTime() - 30 * 86400000);
      return d >= monthAgo;
    }
    return true;
  });
}

export const TIME_FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'month', label: 'هذا الشهر' },
];
