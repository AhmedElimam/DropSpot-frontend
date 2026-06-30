const LOCALE = 'ar-EG';

export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
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
