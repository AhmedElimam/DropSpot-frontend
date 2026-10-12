import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, PanResponder } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { chat, waveform } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';
import { claimVoicePlayback, cycleVoiceRate, getVoiceRate, onVoiceRate, playNextVoiceAfter, registerVoiceNote } from '@/components/chat/voiceQueue';

/**
 * A voice note, drawn as a voice note — and behaving like one.
 *
 * It used to be a bare `<audio controls>` / stock player, which renders as a desktop media
 * widget and made a message look like a file attachment from a different decade (founder,
 * 2026-09-13). This is the product's own control: one round play button, a bar waveform
 * that fills as it plays, and the time.
 *
 * What a voice note DOES here (founder, 2026-09-20: "like WhatsApp"): drag anywhere on the
 * waveform to scrub, tap the speed chip for 1× / 1.5× / 2× (remembered for the session),
 * only one note plays at a time, and when a note ends the next unheard one below it starts.
 * A note you have heard keeps a quieter play button, so a run shows where you stopped.
 *
 * The waveform is derived from the message id, not decoded from the audio: decoding would
 * mean downloading and analysing the file just to draw 28 rectangles. It is stable per
 * message, which is what makes it read as "this clip" rather than decoration.
 */
export function VoiceNote({ url, headers, duration, mine, seed }: {
  url: string;
  headers: Record<string, string>;
  duration: number;
  mine: boolean;
  /** The message id — waveform seed AND the note's place in the room's play order. */
  seed: number;
}) {
  // The clip is fetched into the app cache with OUR headers (token, staging key), then played
  // from disk: the native player's own request carried the headers inconsistently (iOS drops
  // them on the range probe) and a voice note «sent but never played» (founder 2026-10-12).
  // A clip just recorded is already a local file and plays at once.
  const [localUri, setLocalUri] = useState<string | null>(url.startsWith('file:') ? url : null);
  const [fetchFailed, setFetchFailed] = useState(false);
  useEffect(() => {
    if (url.startsWith('file:')) { setLocalUri(url); return; }
    let alive = true;
    (async () => {
      try {
        const dest = new File(Paths.cache, `voice-${Math.abs(seed)}.m4a`);
        if (!dest.exists || (dest.size ?? 0) === 0) {
          try { if (dest.exists) dest.delete(); } catch { /* best effort */ }
          await File.downloadFileAsync(url, dest, { headers });
        }
        if (alive) setLocalUri(dest.uri);
      } catch {
        if (alive) setFetchFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [url, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const player = useAudioPlayer(localUri ? { uri: localUri } : null);
  const status = useAudioPlayerStatus(player);
  const bars = useMemo(() => waveform(seed), [seed]);
  const [rate, setRate] = useState(getVoiceRate());
  const [played, setPlayed] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  const width = useRef(1);
  const playedRef = useRef(false);

  const total = status.duration > 0 ? status.duration : duration;
  const progress = scrub ?? (total > 0 ? Math.min(1, status.currentTime / total) : 0);

  useEffect(() => {
    // The silent switch on an iPhone must not swallow a voice note the child tapped to hear.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => onVoiceRate(setRate), []);
  useEffect(() => { try { player.setPlaybackRate(rate, 'high'); } catch { /* ignore */ } }, [rate, player]);

  const [wantPlay, setWantPlay] = useState(false);
  const play = () => {
    claimVoicePlayback(seed);
    if (!localUri) { setWantPlay(true); return; } // still fetching: start the moment it lands
    try { player.setPlaybackRate(getVoiceRate(), 'high'); player.play(); } catch { /* ignore */ }
  };
  useEffect(() => {
    if (wantPlay && localUri) { setWantPlay(false); try { player.setPlaybackRate(getVoiceRate(), 'high'); player.play(); } catch { /* ignore */ } }
  }, [wantPlay, localUri, player]);
  const pause = () => { try { player.pause(); } catch { /* ignore */ } };

  // In the room's choir for as long as this bubble is on screen.
  useEffect(() => registerVoiceNote(seed, { play, pause, played: () => playedRef.current }), [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status.didJustFinish) {
      try { player.seekTo(0); player.pause(); } catch { /* ignore */ }
      playedRef.current = true;
      setPlayed(true);
      playNextVoiceAfter(seed);
    }
  }, [status.didJustFinish, player, seed]);

  const toggle = () => {
    if (fetchFailed) { setFetchFailed(false); setLocalUri(null); setWantPlay(true); return; } // try the fetch again
    if (status.playing) pause(); else play();
  };

  const seekToFraction = (f: number) => {
    if (total <= 0) return;
    try { player.seekTo(Math.max(0, Math.min(total, f * total))); } catch { /* ignore */ }
  };

  // Drag to scrub. The app forces RTL, so the first bar is on the RIGHT: distance from the
  // right edge is progress. The finger's own position paints the bars while it moves; the
  // player is asked to seek once, on release, so a slow decoder is never asked 60 times.
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => setScrub(fractionAt(e.nativeEvent.locationX, width.current)),
    onPanResponderMove: (e) => setScrub(fractionAt(e.nativeEvent.locationX, width.current)),
    onPanResponderRelease: (e) => { const f = fractionAt(e.nativeEvent.locationX, width.current); setScrub(null); seekToFraction(f); },
    onPanResponderTerminate: () => setScrub(null),
  })).current;

  const fg = mine ? '#fff' : colors.brand;
  const trackOff = mine ? 'rgba(255,255,255,0.34)' : colors.borderStrong;
  const shown = status.playing || status.currentTime > 0 || scrub !== null ? progress * total : total;
  const loading = (!localUri && !fetchFailed && wantPlay) || (!status.isLoaded && status.playing);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 232, paddingVertical: 2 }}>
      <TouchableOpacity
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'إيقاف مؤقت' : 'تشغيل'}
        style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.brandTint,
          alignItems: 'center', justifyContent: 'center',
          opacity: played && !status.playing ? 0.6 : 1,
        }}
      >
        {loading ? <ActivityIndicator size="small" color={fg} /> : (
          <Icon name={fetchFailed ? 'refresh' : status.playing ? 'pause' : 'play'} size={17} color={fg} />
        )}
      </TouchableOpacity>

      {/* The waveform is the scrubber: tap or drag anywhere on it. */}
      <View
        {...pan.panHandlers}
        onLayout={(e) => { width.current = Math.max(1, e.nativeEvent.layout.width); }}
        accessibilityRole="adjustable"
        accessibilityLabel="موضع التشغيل"
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 32 }}
      >
        {bars.map((h, i) => {
          const on = i / bars.length <= progress;
          return (
            <View key={i} pointerEvents="none" style={{ flex: 1, height: Math.max(4, Math.round(h * 24)), borderRadius: 2, backgroundColor: on ? fg : trackOff }} />
          );
        })}
      </View>

      {status.playing || rate !== 1 ? (
        <TouchableOpacity
          onPress={() => setRate(cycleVoiceRate())}
          accessibilityRole="button"
          accessibilityLabel="سرعة التشغيل"
          hitSlop={8}
          style={{ paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.surfaceSunken, minWidth: 34, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: mine ? '#fff' : colors.textSecondary, writingDirection: 'ltr' }}>{rate === 1 ? '1×' : `${rate}×`}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: mine ? chat.metaOnMine : colors.textTertiary, minWidth: 32, textAlign: 'left', writingDirection: 'ltr' }}>
          {fmt(shown)}
        </Text>
      )}
    </View>
  );
}

function fractionAt(locationX: number, width: number): number {
  return Math.max(0, Math.min(1, 1 - locationX / width));
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
