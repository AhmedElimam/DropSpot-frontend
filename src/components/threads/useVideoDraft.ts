import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { useUploadThreadVideo } from '@/hooks/useThreads';
import { canTranscode, cancelTranscode, TranscodeCancelled, transcodeVideo, videoFrame } from '@/lib/drosMedia';
import type { ThreadLimits, ThreadVideo } from '@/api/threads';
import type { RecordedClip } from './VideoRecorder';
import {
  AUDIO_BITRATE, durationWords, isTrimmed, maxKbOf, maxSecondsOf, megabytes, planEncode, reportedDuration,
  TARGET_SHORT_SIDE, videoMimeOf, videoNameOf, type TrimRange,
} from './videoTrim';

/** A clip as it came from the camera or the gallery — before any trim / encode. */
export interface VideoSource {
  uri: string;
  /** Seconds; 0 when the picker did not say (the trim screen then reads it from the player). */
  duration: number;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  mime?: string | null;
  origin: 'camera' | 'library';
}

/** A clip ready to upload: trimmed + compressed on the phone, with its poster frame. */
export interface ReadyVideo {
  uri: string;
  name: string;
  mime: string;
  duration: number;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  posterUri?: string | null;
  source: VideoSource;
  range: TrimRange;
}

class PrepareError extends Error {}

function fileSize(uri: string): number | null {
  try {
    const n = new File(uri).size;
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * One حكاية video attachment, the same in every place a teacher attaches one (the compose sheet
 * and the answer sheet): record in the app or pick from the gallery → trim (WhatsApp-style; opens
 * by itself when the clip is over the limit) → trim + compress on the phone with progress → upload
 * with progress. The caller renders <ThreadVideoField draft={…} /> and calls `upload()` on publish.
 */
export function useVideoDraft(limits: ThreadLimits | undefined, visible: boolean) {
  const { t } = useTranslation();
  const maxSeconds = maxSecondsOf(limits);
  const maxKb = maxKbOf(limits);
  const [video, setVideo] = useState<ReadyVideo | null>(null);
  const [preparing, setPreparing] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ source: VideoSource; range: TrimRange | null } | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const run = useRef(0);
  /** This draft's encode is running on the phone (the encoder is one per app). */
  const encoding = useRef(false);
  const uploadMutation = useUploadThreadVideo();

  const stopEncoder = useCallback(() => {
    run.current++;
    if (encoding.current) {
      encoding.current = false;
      cancelTranscode();
    }
  }, []);

  const cancelPrepare = useCallback(() => {
    stopEncoder();
    setPreparing(null);
  }, [stopEncoder]);

  // Leaving the screen mid-encode stops the encoder.
  useEffect(() => stopEncoder, [stopEncoder]);

  // The sheet closed (or reopened): nothing carries over.
  useEffect(() => {
    if (!visible) return;
    stopEncoder();
    setVideo(null); setPreparing(null); setUploading(null); setEditing(null); setRecorderOpen(false);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = useCallback((message: string) => Alert.alert(t('threads.video_problem'), message), [t]);

  const prepare = useCallback(async (source: VideoSource, range: TrimRange) => {
    const id = ++run.current;
    const alive = () => id === run.current;
    setPreparing(0);
    try {
      const length = Math.max(0, range.end - range.start);
      const trimmed = source.duration > 0 && isTrimmed(range, source.duration);
      const size = source.size ?? fileSize(source.uri);
      const mime = videoMimeOf(source.uri, source.mime);
      let out = { uri: source.uri, mime, duration: length || source.duration, width: source.width, height: source.height, size };

      const plan = planEncode({ duration: out.duration, size, width: source.width, height: source.height, trimmed, maxKb });
      if (plan.transcode && canTranscode()) {
        encoding.current = true;
        const r = await transcodeVideo({
          uri: source.uri,
          startMs: trimmed ? range.start * 1000 : 0,
          endMs: trimmed ? range.end * 1000 : 0,
          maxShortSide: TARGET_SHORT_SIDE,
          videoBitrate: plan.videoBitrate,
          audioBitrate: AUDIO_BITRATE,
        }, (p) => { if (alive()) setPreparing(p); }).finally(() => { if (alive()) encoding.current = false; });
        out = { uri: r.uri, mime: 'video/mp4', duration: r.durationMs / 1000 || out.duration, width: r.width, height: r.height, size: r.size || fileSize(r.uri) };
      } else if (trimmed) {
        // A build without DrosMedia cannot cut the file.
        throw new PrepareError(t('threads.video_needs_update'));
      }
      if (!alive()) return;

      if (reportedDuration(out.duration, maxSeconds) > maxSeconds) {
        throw new PrepareError(t('threads.video_too_long', { limit: durationWords(maxSeconds) }));
      }
      if (out.size && out.size > maxKb * 1024) {
        throw new PrepareError(t('threads.video_too_big', { mb: megabytes(maxKb) }));
      }

      const poster = await videoFrame(out.uri, Math.min(1000, (out.duration * 1000) / 2), 0.6);
      if (!alive()) return;
      setVideo({
        uri: out.uri, name: videoNameOf(out.mime), mime: out.mime, duration: out.duration,
        width: out.width, height: out.height, size: out.size, posterUri: poster?.uri ?? null, source, range,
      });
    } catch (e) {
      if (!alive() || e instanceof TranscodeCancelled) return;
      fail(e instanceof PrepareError ? e.message : t('threads.video_prepare_failed'));
    } finally {
      if (alive()) setPreparing(null);
    }
  }, [maxKb, maxSeconds, fail, t]);

  const onRecorded = useCallback((clip: RecordedClip) => {
    setRecorderOpen(false);
    const source: VideoSource = { uri: clip.uri, duration: clip.duration, mime: clip.mime, origin: 'camera' };
    prepare(source, { start: 0, end: clip.duration });
  }, [prepare]);

  const pickFromLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
        // iOS: hand over the original (HEVC included) instead of a slow H.264 copy — the phone
        // re-encodes once, in DrosMedia, anyway.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const source: VideoSource = {
        uri: a.uri,
        duration: a.duration ? a.duration / 1000 : 0,
        width: a.width || null,
        height: a.height || null,
        size: a.fileSize ?? null,
        mime: a.mimeType ?? null,
        origin: 'library',
      };
      // Over the limit (or length unknown) → the trim screen, handles already at 0 → max.
      // Within it → attach right away; «قصّ» on the tile still opens the trim screen.
      if (!source.duration || source.duration > maxSeconds) {
        setEditing({ source, range: null });
      } else {
        prepare(source, { start: 0, end: source.duration });
      }
    } catch {
      fail(t('threads.video_pick_failed'));
    }
  }, [maxSeconds, prepare, fail, t]);

  const openTrim = useCallback(() => {
    if (video) setEditing({ source: video.source, range: video.range });
  }, [video]);

  const onTrimDone = useCallback((source: VideoSource, range: TrimRange) => {
    setEditing(null);
    prepare(source, range);
  }, [prepare]);

  const remove = useCallback(() => {
    cancelPrepare();
    setVideo(null);
  }, [cancelPrepare]);

  /** Upload the ready clip; resolves to the server's video row (null when nothing is attached). */
  const upload = useCallback(async (): Promise<ThreadVideo | null> => {
    if (!video) return null;
    setUploading(0);
    try {
      return await uploadMutation.mutateAsync({
        uri: video.uri, name: video.name, mime: video.mime,
        duration: reportedDuration(video.duration, maxSeconds),
        width: video.width ?? undefined, height: video.height ?? undefined, posterUri: video.posterUri,
        onProgress: (p) => setUploading(p),
      });
    } finally {
      setUploading(null);
    }
  }, [video, maxSeconds, uploadMutation]);

  return {
    maxSeconds,
    maxKb,
    video,
    preparing,
    uploading,
    editing,
    recorderOpen,
    /** Something is running that closing the sheet would lose. */
    busy: preparing !== null || uploading !== null,
    openRecorder: () => setRecorderOpen(true),
    closeRecorder: () => setRecorderOpen(false),
    onRecorded,
    pickFromLibrary,
    openTrim,
    closeTrim: () => setEditing(null),
    onTrimDone,
    cancelPrepare,
    remove,
    upload,
  };
}

export type VideoDraft = ReturnType<typeof useVideoDraft>;
