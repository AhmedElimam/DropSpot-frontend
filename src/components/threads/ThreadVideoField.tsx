import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { VideoRecorder } from './VideoRecorder';
import { VideoTrimEditor } from './VideoTrimEditor';
import { arDigits } from './format';
import { durationWords, formatClock } from './videoTrim';
import type { VideoDraft } from './useVideoDraft';

/**
 * The video block of the compose and answer sheets (founder 2026-10-15): «صوّر» in the app or
 * «من المعرض», then the clip with «قصّ» / «شيله»; while the phone trims + compresses, and while
 * it uploads, a progress bar takes its place. The recorder and the trim screen are rendered
 * here — inside the sheet's window, so iOS presents them over the sheet instead of queueing them.
 */
export function ThreadVideoField({ draft, label }: { draft: VideoDraft; label: string }) {
  const { t } = useTranslation();
  const limit = durationWords(draft.maxSeconds);

  let body: React.ReactNode;
  if (draft.uploading !== null) {
    body = <Progress icon="send" label={t('threads.uploading_percent', { percent: arDigits(Math.round(draft.uploading * 100)) })} value={draft.uploading} />;
  } else if (draft.preparing !== null) {
    body = (
      <Progress
        icon="cut"
        label={t('threads.preparing_percent', { percent: arDigits(Math.round(draft.preparing * 100)) })}
        hint={t('threads.preparing_hint')}
        value={draft.preparing}
        onCancel={draft.cancelPrepare}
        cancelLabel={t('threads.preparing_stop')}
      />
    );
  } else if (draft.video) {
    const v = draft.video;
    body = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight }}>
        <View style={{ width: 44, height: 62, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1E2657', alignItems: 'center', justifyContent: 'center' }}>
          {v.posterUri ? <Image source={{ uri: v.posterUri }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} contentFit="cover" /> : null}
          <Icon name="play" size={18} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.successText }}>{t('threads.video_ready', { length: formatClock(v.duration) })}</Text>
          {v.size ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.successText, opacity: 0.8 }}>{t('threads.video_size', { mb: arDigits((v.size / 1024 / 1024).toFixed(1)) })}</Text> : null}
        </View>
        <Chip icon="cut" label={t('threads.trim')} color={colors.brand} onPress={draft.openTrim} />
        <Chip label={t('threads.remove_video')} color={colors.danger} onPress={draft.remove} />
      </View>
    );
  } else {
    body = (
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="video" size={18} color={colors.brand} />
          <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{label}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }}>{t('threads.video_limit', { limit })}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Source icon="video" label={t('threads.record_short')} onPress={draft.openRecorder} />
          <Source icon="gallery" label={t('threads.from_gallery')} onPress={draft.pickFromLibrary} />
        </View>
      </View>
    );
  }

  return (
    <>
      {body}
      <VideoRecorder visible={draft.recorderOpen} maxSeconds={draft.maxSeconds} onClose={draft.closeRecorder} onRecorded={draft.onRecorded} />
      <VideoTrimEditor editing={draft.editing} maxSeconds={draft.maxSeconds} onCancel={draft.closeTrim} onDone={draft.onTrimDone} />
    </>
  );
}

function Source({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button"
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 56, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surface }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.brand} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ icon, label, color, onPress }: { icon?: IconName; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={6} accessibilityRole="button"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.full, backgroundColor: colors.surface }}>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color }}>{label}</Text>
    </TouchableOpacity>
  );
}

function Progress({ icon, label, hint, value, onCancel, cancelLabel }: { icon: IconName; label: string; hint?: string; value: number; onCancel?: () => void; cancelLabel?: string }) {
  const pct = `${Math.round(Math.max(0.02, Math.min(1, value)) * 100)}%`;
  return (
    <View style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTint, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={icon} size={18} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.brand }}>{label}</Text>
          {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{hint}</Text> : null}
        </View>
        {onCancel && cancelLabel ? <Chip label={cancelLabel} color={colors.danger} onPress={onCancel} /> : null}
      </View>
      {/* A plain bar: a few renders a second at most (the encoder reports ~1% steps). */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <View style={{ width: pct as `${number}%`, height: 6, borderRadius: 3, backgroundColor: colors.brand }} />
      </View>
    </View>
  );
}
