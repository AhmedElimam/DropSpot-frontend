const LOCALE = 'ar-EG';

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...options,
  });
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
}

// Full day + date, e.g. "الاثنين ١٢ أغسطس". Used wherever a session/attendance
// row needs its calendar day spelled out.
export function formatDayDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
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
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
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
