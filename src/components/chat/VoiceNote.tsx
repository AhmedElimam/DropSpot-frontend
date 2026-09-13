import { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { fonts } from '@/theme/typography';
import { colors, spacing } from '@/theme/index';
import { chat, waveform } from '@/theme/chat';
import { Icon } from '@/components/ui/Icon';

/**
 * A voice note, drawn as a voice note.
 *
 * It used to be a bare `<audio controls>` / stock player, which renders as a desktop media
 * widget — grey chrome, a scrub rail, a volume slider — and made a message look like a file
 * attachment from a different decade (founder, 2026-09-13). This is the product's own
 * control: one round play button, a bar waveform that fills as it plays, and the time.
 *
 * The waveform is derived from the message id, not decoded from the audio: decoding would
 * mean downloading and analysing the file just to draw 28 rectangles. It is stable per
 * message, which is what makes it read as "this clip" rather than decoration.
 *
 * Tapping a bar seeks there — the one interaction people actually want from a voice note,
 * and the reason a plain progress line is not enough.
 */
export function VoiceNote({ url, headers, duration, mine, seed }: {
  url: string;
  headers: Record<string, string>;
  duration: number;
  mine: boolean;
  seed: number;
}) {
  const player = useAudioPlayer({ uri: url, headers });
  const status = useAudioPlayerStatus(player);
  const bars = useMemo(() => waveform(seed), [seed]);

  const total = status.duration > 0 ? status.duration : duration;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;

  useEffect(() => {
    // The silent switch on an iPhone must not swallow a voice note the child tapped to hear.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status.didJustFinish) {
      try { player.seekTo(0); player.pause(); } catch { /* ignore */ }
    }
  }, [status.didJustFinish, player]);

  const toggle = () => {
    try {
      if (status.playing) player.pause();
      else player.play();
    } catch { /* ignore */ }
  };

  const seekToFraction = (f: number) => {
    if (total <= 0) return;
    try { player.seekTo(Math.max(0, Math.min(total, f * total))); } catch { /* ignore */ }
  };

  const fg = mine ? '#fff' : colors.brand;
  const trackOff = mine ? 'rgba(255,255,255,0.34)' : colors.borderStrong;
  const shown = status.playing || status.currentTime > 0 ? status.currentTime : total;
  const loading = !status.isLoaded && status.playing;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 210, paddingVertical: 2 }}>
      <TouchableOpacity
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'إيقاف مؤقت' : 'تشغيل'}
        style={{
          width: 38, height: 38, borderRadius: 19,
          backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.brandTint,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {loading ? <ActivityIndicator size="small" color={fg} /> : (
          <Icon name={status.playing ? 'pause' : 'play'} size={17} color={fg} />
        )}
      </TouchableOpacity>

      {/* The waveform doubles as the scrubber — each bar is its own tap target. */}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 }}>
        {bars.map((h, i) => {
          const played = i / bars.length <= progress;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => seekToFraction((i + 0.5) / bars.length)}
              accessibilityRole="adjustable"
              activeOpacity={0.7}
              style={{ flex: 1, height: 28, justifyContent: 'center' }}
            >
              <View
                style={{
                  height: Math.max(4, Math.round(h * 24)),
                  borderRadius: 2,
                  backgroundColor: played ? fg : trackOff,
                }}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: mine ? chat.metaOnMine : colors.textTertiary, minWidth: 32, textAlign: 'left' }}>
        {fmt(shown)}
      </Text>
    </View>
  );
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
