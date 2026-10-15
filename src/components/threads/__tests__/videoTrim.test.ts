/**
 * حكاوي videos (founder 2026-10-15: «up to 5 minutes», «a crop tool like WhatsApp»): the trim
 * handles' bounds, the labels, and when the phone has to re-encode before upload.
 */
import {
  clampRange, DEFAULT_VIDEO_MAX_KB, DEFAULT_VIDEO_MAX_SECONDS, durationWords, filmstripTimes, formatClock, initialRange,
  isTrimmed, maxKbOf, maxSecondsOf, megabytes, MIN_VIDEO_BITRATE, planEncode, reportedDuration, TARGET_VIDEO_BITRATE, videoMimeOf, videoNameOf,
} from '../videoTrim';

describe('limits', () => {
  it('reads the feed, falls back to five minutes / 150 MB', () => {
    expect(maxSecondsOf({ video_max_seconds: 120 })).toBe(120);
    expect(maxSecondsOf(undefined)).toBe(DEFAULT_VIDEO_MAX_SECONDS);
    expect(DEFAULT_VIDEO_MAX_SECONDS).toBe(300);
    expect(maxSecondsOf({ video_max_seconds: 0 })).toBe(300);
    expect(maxKbOf({ video_max_kb: 2048 })).toBe(2048);
    expect(maxKbOf(null)).toBe(DEFAULT_VIDEO_MAX_KB);
  });
});

describe('initialRange', () => {
  it('opens on the whole clip when it fits', () => {
    expect(initialRange(42, 300)).toEqual({ start: 0, end: 42 });
  });
  it('opens on the first max seconds of a longer clip', () => {
    expect(initialRange(900, 300)).toEqual({ start: 0, end: 300 });
  });
});

describe('clampRange', () => {
  const D = 600;
  const MAX = 300;
  it('keeps the start inside the clip and before the end', () => {
    expect(clampRange({ start: -5, end: 100 }, D, MAX, 'start')).toEqual({ start: 0, end: 100 });
    expect(clampRange({ start: 100, end: 100 }, D, MAX, 'start')).toEqual({ start: 99, end: 100 });
  });
  it('never lets the start make the piece longer than max', () => {
    expect(clampRange({ start: 0, end: 400 }, D, MAX, 'start')).toEqual({ start: 100, end: 400 });
  });
  it('keeps the end inside the clip, after the start, and within max of it', () => {
    expect(clampRange({ start: 10, end: 700 }, D, MAX, 'end')).toEqual({ start: 10, end: 310 });
    expect(clampRange({ start: 10, end: 5 }, D, MAX, 'end')).toEqual({ start: 10, end: 11 });
    expect(clampRange({ start: 400, end: 900 }, D, MAX, 'end')).toEqual({ start: 400, end: 600 });
  });
  it('works for a clip shorter than the minimum piece', () => {
    expect(clampRange({ start: 0, end: 0.5 }, 0.5, MAX, 'end')).toEqual({ start: 0, end: 0.5 });
  });
  it('leaves a legal range alone', () => {
    expect(clampRange({ start: 12.5, end: 44 }, D, MAX, 'start')).toEqual({ start: 12.5, end: 44 });
    expect(clampRange({ start: 12.5, end: 44 }, D, MAX, 'end')).toEqual({ start: 12.5, end: 44 });
  });
});

describe('isTrimmed', () => {
  it('ignores encoder-sized slack at the edges', () => {
    expect(isTrimmed({ start: 0, end: 60 }, 60.02)).toBe(false);
    expect(isTrimmed({ start: 1, end: 60 }, 60)).toBe(true);
    expect(isTrimmed({ start: 0, end: 50 }, 60)).toBe(true);
  });
});

describe('labels', () => {
  it('formats the clock in Arabic digits', () => {
    expect(formatClock(32)).toBe('٠:٣٢');
    expect(formatClock(300)).toBe('٥:٠٠');
    expect(formatClock(725)).toBe('١٢:٠٥');
    expect(formatClock(-3)).toBe('٠:٠٠');
    expect(formatClock(59.6)).toBe('١:٠٠');
  });
  it('says the limit in words', () => {
    expect(durationWords(300)).toBe('٥ دقايق');
    expect(durationWords(120)).toBe('دقيقتين');
    expect(durationWords(60)).toBe('دقيقة');
    expect(durationWords(90)).toBe('٩٠ ثانية');
    expect(durationWords(45)).toBe('٤٥ ثانية');
    expect(durationWords(900)).toBe('١٥ دقيقة');
  });
  it('says the size cap in megabytes', () => {
    expect(megabytes(150 * 1024)).toBe('١٥٠ م.ب');
  });
});

describe('planEncode', () => {
  const maxKb = 150 * 1024;
  it('re-encodes a trimmed clip', () => {
    expect(planEncode({ duration: 60, size: 5_000_000, width: 720, height: 1280, trimmed: true, maxKb }).transcode).toBe(true);
  });
  it('re-encodes a heavy phone recording (1080p, high bitrate)', () => {
    expect(planEncode({ duration: 60, size: 120_000_000, width: 1080, height: 1920, trimmed: false, maxKb }).transcode).toBe(true);
  });
  it('re-encodes when it cannot tell the size or the frame', () => {
    expect(planEncode({ duration: 60, size: null, width: 720, height: 1280, trimmed: false, maxKb }).transcode).toBe(true);
    expect(planEncode({ duration: 60, size: 10_000_000, trimmed: false, maxKb }).transcode).toBe(true);
  });
  it('sends an already lean 720p clip as it is', () => {
    expect(planEncode({ duration: 60, size: 18_000_000, width: 720, height: 1280, trimmed: false, maxKb }).transcode).toBe(false);
  });
  it('aims at 2 Mbps, lower when the cap demands it, never below the floor', () => {
    expect(planEncode({ duration: 300, size: 0, trimmed: false, maxKb }).videoBitrate).toBe(TARGET_VIDEO_BITRATE);
    const tight = planEncode({ duration: 300, size: 0, trimmed: false, maxKb: 50 * 1024 }).videoBitrate;
    expect(tight).toBeLessThan(TARGET_VIDEO_BITRATE);
    expect((tight + 96_000) * 300 / 8).toBeLessThan(50 * 1024 * 1024);
    expect(planEncode({ duration: 300, size: 0, trimmed: false, maxKb: 1024 }).videoBitrate).toBe(MIN_VIDEO_BITRATE);
  });
  it('five minutes at the target lands well under ~120 MB', () => {
    const { videoBitrate } = planEncode({ duration: 300, size: 0, trimmed: false, maxKb });
    expect(((videoBitrate + 96_000) * 300) / 8 / 1024 / 1024).toBeLessThan(80);
  });
});

describe('reportedDuration', () => {
  it('rounds, and forgives an encoder overrun of under a second at the cap', () => {
    expect(reportedDuration(42.4, 300)).toBe(42);
    expect(reportedDuration(300.4, 300)).toBe(300);
    expect(reportedDuration(0.3, 300)).toBe(1);
    expect(reportedDuration(302, 300)).toBe(302);
  });
});

describe('filmstripTimes', () => {
  it('centres one frame per tile', () => {
    expect(filmstripTimes(10, 5)).toEqual([1000, 3000, 5000, 7000, 9000]);
    expect(filmstripTimes(0, 5)).toEqual([]);
  });
});

describe('mime + name', () => {
  it('guesses from the extension when the picker did not say', () => {
    expect(videoMimeOf('file:///a/b.MOV')).toBe('video/quicktime');
    expect(videoMimeOf('file:///a/b.mp4')).toBe('video/mp4');
    expect(videoMimeOf('file:///a/b', 'video/webm')).toBe('video/webm');
    expect(videoNameOf('video/quicktime')).toBe('hikaya.mov');
    expect(videoNameOf('video/mp4')).toBe('hikaya.mp4');
  });
});
