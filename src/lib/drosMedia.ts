import { requireOptionalNativeModule } from 'expo';

/**
 * JS side of the app's own native module, modules/dros-media (DrosMediaModule.swift / .kt).
 *
 * WHY OUR OWN MODULE (evaluated 2026-10-15 for حكاوي's «crop like WhatsApp» + 5-minute videos):
 *  - react-native-video-trim 8.x — has a ready WhatsApp-like editor, but its podspec / gradle
 *    pull `ffmpeg-mobile-min` / `ffmpeg-kit-*`, a fork of the retired ffmpeg-kit (+~10 MB per ABI).
 *  - react-native-media-toolkit 2.x — trim + compress, but Nitro-only (react-native-nitro-modules
 *    + C++ codegen next to our static frameworks), one maintainer, no progress events.
 *  - react-native-compressor 1.19 — good compressor, no trimming; Android pulls a JitPack artifact.
 *  - expo-video-clipper 0.1.0 / expo-trim-video 1.0.1 — single releases, no downscale / bitrate.
 * What every one of them wraps is the platform's own encoder: AVFoundation on iOS, Media3
 * Transformer on Android. So we call those directly — ~300 lines of native code, no third-party
 * binary, trim + downscale + bitrate in ONE pass with progress, Media3 pinned to expo-video's.
 * The trim UI is ours (VideoTrimEditor.tsx); the filmstrip and poster frames come from
 * expo-video-thumbnails (Expo's own, SDK-matched).
 *
 * Every entry point degrades: on a build without the module (an old dev client, Expo Go)
 * `canTranscode` is false and the caller falls back to "upload as is, if within the caps".
 */

export interface TranscodeOptions {
  uri: string;
  startMs: number;
  /** <= startMs = to the end. */
  endMs: number;
  maxShortSide: number;
  videoBitrate: number;
  audioBitrate: number;
}

export interface TranscodeResult {
  uri: string;
  durationMs: number;
  width: number;
  height: number;
  size: number;
}

interface Subscription {
  remove(): void;
}

interface DrosMediaNative {
  transcodeAsync(options: TranscodeOptions): Promise<TranscodeResult>;
  cancelTranscodeAsync(): Promise<unknown>;
  isScreenCapturedAsync(): Promise<boolean>;
  addListener(event: 'onTranscodeProgress', listener: (e: { progress: number }) => void): Subscription;
  addListener(event: 'onScreenCaptureChanged', listener: (e: { captured: boolean }) => void): Subscription;
}

interface VideoThumbnailsNative {
  getThumbnail(uri: string, options: { time?: number; quality?: number; headers?: Record<string, string> }): Promise<{ uri: string; width: number; height: number }>;
}

let drosMedia: DrosMediaNative | null | undefined;
function native(): DrosMediaNative | null {
  if (drosMedia === undefined) {
    try {
      drosMedia = requireOptionalNativeModule<DrosMediaNative>('DrosMedia');
    } catch {
      drosMedia = null;
    }
  }
  return drosMedia;
}

let thumbnails: VideoThumbnailsNative | null | undefined;
function thumbs(): VideoThumbnailsNative | null {
  // Through the optional loader, never `import 'expo-video-thumbnails'`: that package calls
  // requireNativeModule at import time and would take the whole bundle down on a build
  // without it.
  if (thumbnails === undefined) {
    try {
      thumbnails = requireOptionalNativeModule<VideoThumbnailsNative>('ExpoVideoThumbnails');
    } catch {
      thumbnails = null;
    }
  }
  return thumbnails;
}

export function canTranscode(): boolean {
  return !!native();
}

export class TranscodeCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

/** Trim + shrink + re-encode on the phone. Rejects with TranscodeCancelled after `cancelTranscode`. */
export async function transcodeVideo(options: TranscodeOptions, onProgress?: (fraction: number) => void): Promise<TranscodeResult> {
  const mod = native();
  if (!mod) throw new Error('DrosMedia is not in this build');
  const sub = onProgress ? mod.addListener('onTranscodeProgress', (e) => onProgress(Math.max(0, Math.min(1, Number(e?.progress) || 0)))) : null;
  try {
    return await mod.transcodeAsync(options);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'ERR_CANCELLED') throw new TranscodeCancelled();
    throw e;
  } finally {
    sub?.remove();
  }
}

export function cancelTranscode(): void {
  native()?.cancelTranscodeAsync().catch(() => {});
}

/** iOS: the screen is being recorded or mirrored right now. Android: always false (see the .kt). */
export async function isScreenCaptured(): Promise<boolean> {
  try {
    return !!(await native()?.isScreenCapturedAsync());
  } catch {
    return false;
  }
}

/** iOS: called when screen recording / mirroring starts or stops. Null where unsupported. */
export function addScreenCaptureListener(listener: (captured: boolean) => void): Subscription | null {
  const mod = native();
  if (!mod) return null;
  try {
    return mod.addListener('onScreenCaptureChanged', (e) => listener(!!e?.captured));
  } catch {
    return null;
  }
}

export function canMakeThumbnails(): boolean {
  return !!thumbs();
}

/** One JPEG frame of a local video; null when the module is missing or the frame fails. */
export async function videoFrame(uri: string, timeMs: number, quality = 0.5): Promise<{ uri: string; width: number; height: number } | null> {
  const mod = thumbs();
  if (!mod) return null;
  try {
    return await mod.getThumbnail(uri, { time: Math.max(0, Math.round(timeMs)), quality });
  } catch {
    return null;
  }
}
