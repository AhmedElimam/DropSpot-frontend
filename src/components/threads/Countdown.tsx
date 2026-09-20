import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import { fonts } from '@/theme/typography';

/**
 * A live «HH:MM:SS» from an ISO end time. Ticks itself; the caller learns that zero was hit
 * through `onElapsed` (once) so the screen can refetch and show the closed state.
 */
export function Countdown({ endsAt, style, onElapsed }: { endsAt: string; style?: TextStyle; onElapsed?: () => void }) {
  const [left, setLeft] = useState(() => secondsUntil(endsAt));

  useEffect(() => {
    setLeft(secondsUntil(endsAt));
    let fired = false;
    const id = setInterval(() => {
      const s = secondsUntil(endsAt);
      setLeft(s);
      if (s <= 0 && !fired) { fired = true; onElapsed?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return <Text style={[{ fontFamily: fonts.bold, fontVariant: ['tabular-nums'] }, style]}>{formatLeft(left)}</Text>;
}

export function secondsUntil(iso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 1000));
}

/** Days when far, hours when near, minutes:seconds in the last hour. */
export function formatLeft(s: number): string {
  if (s >= 86400) return `${Math.floor(s / 86400)} ي ${Math.floor((s % 86400) / 3600)} س`;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
