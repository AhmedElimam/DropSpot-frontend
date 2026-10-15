import { arDigits } from './format';

/**
 * حكاوي videos — the pure half of the trim screen and the on-phone encode (founder 2026-10-15:
 * «up to 5 minutes», «a crop tool like WhatsApp, an easy one»). No React, no native modules:
 * everything here is unit-tested (__tests__/videoTrim.test.ts).
 */

/** Used until the feed says otherwise (`limits.video_max_seconds` / `limits.video_max_kb`). */
export const DEFAULT_VIDEO_MAX_SECONDS = 300;
export const DEFAULT_VIDEO_MAX_KB = 150 * 1024;
/** The shortest piece the handles can leave. */
export const MIN_TRIM_SECONDS = 1;
/** What the phone encodes to: 720p, ~2 Mbps H.264 + 96 kbps AAC → 5 min ≈ 75 MB. */
export const TARGET_SHORT_SIDE = 720;
export const TARGET_VIDEO_BITRATE = 2_000_000;
export const MIN_VIDEO_BITRATE = 600_000;
export const AUDIO_BITRATE = 96_000;
/** A file already this lean (and small enough on screen) goes up as it is. */
const PASS_THROUGH_BITRATE = 3_500_000;
const PASS_THROUGH_LONG_SIDE = 1280;

export interface TrimRange {
  start: number;
  end: number;
}

export function maxSecondsOf(limits?: { video_max_seconds?: number | null } | null): number {
  const v = Number(limits?.video_max_seconds);
  return v > 0 ? v : DEFAULT_VIDEO_MAX_SECONDS;
}

export function maxKbOf(limits?: { video_max_kb?: number | null } | null): number {
  const v = Number(limits?.video_max_kb);
  return v > 0 ? v : DEFAULT_VIDEO_MAX_KB;
}

/** Where the handles start: the whole clip, or its first `max` seconds when it is longer. */
export function initialRange(duration: number, max: number): TrimRange {
  const d = Math.max(0, duration);
  return { start: 0, end: Math.min(d, max) };
}

/**
 * Keeps a range legal while one handle moves: inside the clip, at least MIN long, at most
 * `max` long. The handle being dragged gives way; the other one stays put.
 */
export function clampRange(range: TrimRange, duration: number, max: number, moving: 'start' | 'end', min = 1 /* MIN_TRIM_SECONDS — a literal, so the worklet captures nothing */): TrimRange {
  'worklet'; // also runs on the UI thread, inside the trim handles' pan gestures
  const d = Math.max(0, duration);
  const floor = Math.min(min, d);
  let { start, end } = range;
  if (moving === 'start') {
    end = Math.min(Math.max(end, floor), d);
    start = Math.min(Math.max(start, Math.max(0, end - max)), end - floor);
    start = Math.max(0, start);
  } else {
    start = Math.max(0, Math.min(start, d - floor));
    end = Math.max(Math.min(end, Math.min(d, start + max)), start + floor);
    end = Math.min(d, end);
  }
  return { start, end };
}

/** True when the kept range is not the whole clip (a re-encode is then unavoidable). */
export function isTrimmed(range: TrimRange, duration: number): boolean {
  return range.start > 0.05 || range.end < duration - 0.05;
}

/** «٥:٠٠», «٠:٣٢», «١٢:٠٥» — the length label under the filmstrip. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return arDigits(`${m}:${String(s % 60).padStart(2, '0')}`);
}

/** «٥ دقايق», «دقيقتين», «٩٠ ثانية» — the limit in a sentence. */
export function durationWords(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60 || s % 60 !== 0) return `${arDigits(s)} ثانية`;
  const m = s / 60;
  if (m === 1) return 'دقيقة';
  if (m === 2) return 'دقيقتين';
  if (m <= 10) return `${arDigits(m)} دقايق`;
  return `${arDigits(m)} دقيقة`;
}

/** «١٥٠ م.ب» — a KB cap in megabytes. */
export function megabytes(kb: number): string {
  return `${arDigits(Math.round(kb / 1024))} م.ب`;
}

export interface EncodePlan {
  /** Re-encode on the phone (trim and/or shrink); false = upload the file as it is. */
  transcode: boolean;
  videoBitrate: number;
}

/**
 * Decide whether the clip needs the phone's encoder, and at what bitrate. The bitrate aims at
 * 2 Mbps (sharp 720p for a whiteboard) but never at more than ~85% of what the size cap allows
 * for this length, so a long clip still lands under `maxKb`.
 */
export function planEncode(input: { duration: number; size?: number | null; width?: number | null; height?: number | null; trimmed: boolean; maxKb: number }): EncodePlan {
  const duration = Math.max(1, input.duration);
  const budget = Math.floor((input.maxKb * 1024 * 8 * 0.85) / duration) - AUDIO_BITRATE;
  const videoBitrate = Math.max(MIN_VIDEO_BITRATE, Math.min(TARGET_VIDEO_BITRATE, budget));
  const size = input.size ?? 0;
  const longSide = Math.max(input.width ?? 0, input.height ?? 0);
  const transcode = input.trimmed
    || size <= 0
    || size > input.maxKb * 1024
    || (size * 8) / duration > PASS_THROUGH_BITRATE
    || longSide === 0
    || longSide > PASS_THROUGH_LONG_SIDE;
  return { transcode, videoBitrate };
}

/** The duration the upload reports: whole seconds, never past the cap for a sub-second overrun. */
export function reportedDuration(duration: number, max: number): number {
  const s = Math.max(1, Math.round(duration));
  return s > max && duration <= max + 1 ? max : s;
}

/** Evenly spaced filmstrip times (ms), each in the middle of its tile. */
export function filmstripTimes(duration: number, count: number): number[] {
  if (duration <= 0 || count <= 0) return [];
  const step = duration / count;
  return Array.from({ length: count }, (_, i) => Math.round((i + 0.5) * step * 1000));
}

/** A video's MIME type from its file name, when the picker did not say. */
export function videoMimeOf(uri: string, given?: string | null): string {
  if (given && given.startsWith('video/')) return given;
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'mov' || ext === 'qt') return 'video/quicktime';
  if (ext === '3gp') return 'video/3gpp';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'm4v') return 'video/x-m4v';
  return 'video/mp4';
}

export function videoNameOf(mime: string): string {
  const ext = mime === 'video/quicktime' ? 'mov' : mime === 'video/3gpp' ? '3gp' : mime === 'video/webm' ? 'webm' : mime === 'video/x-m4v' ? 'm4v' : 'mp4';
  return `hikaya.${ext}`;
}
