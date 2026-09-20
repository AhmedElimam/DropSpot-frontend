import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Switch, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAnswerThread, useResolveThreadReport, useThreadReports, useThreadVideoAudience, useUpdateThreadSettings, useUploadThreadVideo } from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { timeAgo } from '@/utils/format';
import { VideoRecorder, type RecordedClip } from './VideoRecorder';
import { TIMER_PRESETS } from './ComposeThreadSheet';
import type { ThreadSettings } from '@/api/threads';

/** The shared bottom-sheet frame: overlay, rounded top, title row with a close button. */
export function Sheet({ visible, title, onClose, children, busy }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, textAlign: 'right' }}>{title}</Text>
            <TouchableOpacity onPress={onClose} disabled={busy} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg + insets.bottom, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export const inputStyle = {
  minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const, backgroundColor: colors.surfaceSunken,
};

/** A student reports another student's answer: a reason chip and an optional line. */
export function ReportSheet({ visible, reasons, pending, onClose, onSubmit }: {
  visible: boolean; reasons: Record<string, string>; pending: boolean; onClose: () => void; onSubmit: (reason: string, note: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) { setReason(null); setNote(''); } }, [visible]);

  return (
    <Sheet visible={visible} title={t('threads.report')} onClose={onClose} busy={pending}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'right' }}>{t('threads.report_hint')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {Object.entries(reasons).map(([k, label]) => {
          const on = reason === k;
          return (
            <TouchableOpacity key={k} onPress={() => setReason(k)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: on ? colors.brandDeep : colors.textSecondary }}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput value={note} onChangeText={setNote} placeholder={t('threads.report_note')} placeholderTextColor={colors.textTertiary} maxLength={500} multiline style={[inputStyle, { minHeight: 72 }]} />
      <Button title={t('threads.report_send')} variant="destructive" onPress={() => reason && onSubmit(reason, note.trim())} disabled={!reason || pending} loading={pending} />
    </Sheet>
  );
}

/** One line of text the caller needs — the hide reason. */
export function TextSheet({ visible, title, placeholder, confirm, pending, onClose, onSubmit }: {
  visible: boolean; title: string; placeholder: string; confirm: string; pending: boolean; onClose: () => void; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(''); }, [visible]);
  return (
    <Sheet visible={visible} title={title} onClose={onClose} busy={pending}>
      <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.textTertiary} maxLength={160} multiline autoFocus style={[inputStyle, { minHeight: 72 }]} />
      <Button title={confirm} onPress={() => onSubmit(text.trim())} disabled={pending} loading={pending} />
    </Sheet>
  );
}

/** The teacher's answer: text, a recorded clip, or both. Publishing closes the round. */
export function AnswerSheet({ visible, threadId, maxSeconds, onClose, onDone }: {
  visible: boolean; threadId: number; maxSeconds: number; onClose: () => void; onDone: () => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const answer = useAnswerThread(threadId);
  const upload = useUploadThreadVideo();
  const busy = answer.isPending || upload.isPending;
  useEffect(() => { if (visible) { setBody(''); setClip(null); } }, [visible]);

  const publish = async () => {
    try {
      let videoId: number | null = null;
      if (clip) {
        videoId = (await upload.mutateAsync({ uri: clip.uri, name: clip.name, mime: clip.mime, duration: clip.duration })).id;
      }
      await answer.mutateAsync({ body: body.trim() || undefined, video_id: videoId });
      onDone();
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    }
  };

  return (
    <>
      <Sheet visible={visible} title={t('threads.answer_title')} onClose={onClose} busy={busy}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, textAlign: 'right' }}>{t('threads.answer_hint')}</Text>
        <TextInput value={body} onChangeText={setBody} placeholder={t('threads.answer_placeholder')} placeholderTextColor={colors.textTertiary} maxLength={4000} multiline style={[inputStyle, { minHeight: 110, textAlignVertical: 'top' }]} />
        {clip ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.successLight }}>
            <Icon name="video" size={20} color={colors.successText} />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.successText, textAlign: 'right' }}>{t('threads.video_attached', { seconds: clip.duration })}</Text>
            <TouchableOpacity onPress={() => setClip(null)}><Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.danger }}>{t('threads.remove_video')}</Text></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setRecorderOpen(true)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong }}>
            <Icon name="video" size={20} color={colors.brand} outline />
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.brand }}>{t('threads.or_record')}</Text>
          </TouchableOpacity>
        )}
        <Button title={upload.isPending ? t('threads.uploading') : t('threads.publish_answer')} variant="success" onPress={publish} disabled={busy || (!body.trim() && !clip)} loading={busy} />
      </Sheet>
      <VideoRecorder visible={recorderOpen} maxSeconds={maxSeconds} onClose={() => setRecorderOpen(false)} onRecorded={(c) => { setClip(c); setRecorderOpen(false); }} />
    </>
  );
}

/** More time for the round. */
export function ExtendSheet({ visible, pending, onClose, onSubmit }: { visible: boolean; pending: boolean; onClose: () => void; onSubmit: (minutes: number | null) => void }) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} title={t('threads.extend_title')} onClose={onClose} busy={pending}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TIMER_PRESETS.map((p) => (
          <TouchableOpacity key={p.minutes} onPress={() => onSubmit(p.minutes > 0 ? p.minutes : null)} disabled={pending} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary }}>{t(p.key)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Sheet>
  );
}

/** Who watched a video, and who tried to capture it. */
export function AudienceSheet({ videoId, onClose }: { videoId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useThreadVideoAudience(videoId, !!videoId);
  return (
    <Sheet visible={!!videoId} title={t('threads.who_watched')} onClose={onClose}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : !data || data.viewers.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'right' }}>{t('threads.who_watched_empty')}</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Stat label={t('threads.plays', { count: data.plays_count })} tone="brand" />
            {data.capture_attempts > 0 ? <Stat label={t('threads.capture_attempts', { count: data.capture_attempts })} tone="danger" /> : null}
          </View>
          {data.viewers.map((v) => (
            <View key={v.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: v.capture_attempts ? colors.dangerLight : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={v.capture_attempts ? 'warning' : 'eye'} size={18} color={v.capture_attempts ? colors.danger : colors.brand} outline />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right' }}>{v.name}{v.student_code ? ` · ${v.student_code}` : ''}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'right' }}>
                  {v.codes.slice(0, 3).join('  ')}{v.last_at ? ` · ${timeAgo(v.last_at)}` : ''}
                </Text>
              </View>
              {v.capture_attempts ? <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.danger }}>{t('threads.capture_attempts', { count: v.capture_attempts })}</Text> : null}
            </View>
          ))}
        </>
      )}
    </Sheet>
  );
}

/** The teacher's own switch and the down-vote toggle. */
export function SettingsSheet({ visible, settings, onClose }: { visible: boolean; settings: ThreadSettings | undefined; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateThreadSettings();
  const set = (patch: Partial<ThreadSettings>) => update.mutate(patch, { onError: (e) => Alert.alert(t('common.error'), getFriendlyErrorMessage(e)) });

  return (
    <Sheet visible={visible} title={t('threads.settings')} onClose={onClose}>
      <Row title={t('threads.settings_enabled')} hint={t('threads.settings_enabled_hint')} value={!!settings?.enabled} onChange={(v) => set({ enabled: v })} />
      <Row title={t('threads.settings_downvotes')} value={settings?.downvotes_enabled ?? true} onChange={(v) => set({ downvotes_enabled: v })} />
    </Sheet>
  );
}

/** Open reports, with the two answers a moderator has. */
export function ReportsSheet({ visible, onClose, onOpenThread }: { visible: boolean; onClose: () => void; onOpenThread: (id: number) => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useThreadReports(visible);
  const resolve = useResolveThreadReport();
  return (
    <Sheet visible={visible} title={t('threads.reports')} onClose={onClose}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : !data?.length ? (
        <EmptyState icon="flag" title={t('threads.reports_empty')} />
      ) : data.map((r) => (
        <View key={r.id} style={{ padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStartWidth: 4, borderStartColor: colors.warning, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.warningText }}>{r.reason_label}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary }}>{t('threads.report_on', { name: r.reported_user.name })} · {t('threads.report_by', { name: r.reporter.name })}</Text>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>{r.captured_body}</Text>
          {r.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary, textAlign: 'right' }}>«{r.note}»</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button title={r.already_hidden ? t('threads.hidden') : t('threads.report_remove')} variant="destructive" onPress={() => resolve.mutate({ reportId: r.id, action: 'remove' })} disabled={resolve.isPending} /></View>
            <View style={{ flex: 1 }}><Button title={t('threads.report_dismiss')} variant="outline" onPress={() => resolve.mutate({ reportId: r.id, action: 'dismiss' })} disabled={resolve.isPending} /></View>
            <TouchableOpacity onPress={() => onOpenThread(r.thread_id)} style={{ width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
              <Icon name="back" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

function Row({ title, hint, value, onChange }: { title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary, textAlign: 'right' }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textSecondary, textAlign: 'right', marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand, false: colors.border }} />
    </View>
  );
}

function Stat({ label, tone }: { label: string; tone: 'brand' | 'danger' }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: tone === 'brand' ? colors.brandTint : colors.dangerLight }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: tone === 'brand' ? colors.brandDeep : colors.dangerText }}>{label}</Text>
    </View>
  );
}
