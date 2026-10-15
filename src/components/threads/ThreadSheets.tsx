import { useEffect, useState, type ReactNode } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius } from '@/theme/index';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAnswerThread, useResolveThreadReport, useThreadReports, useThreadVideoAudience, useUpdateThreadSettings } from '@/hooks/useThreads';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { ThreadVideoField } from './ThreadVideoField';
import { useVideoDraft } from './useVideoDraft';
import { InitialsAvatar } from './Avatar';
import { TIMER_PRESETS, ago, arDigits } from './format';
import type { ThreadLimits, ThreadSettings } from '@/api/threads';

type Tone = 'brand' | 'warm' | 'success' | 'danger' | 'warning';

const toneOf = (tone: Tone) => ({
  brand: { bg: colors.brandTint, ink: colors.brand },
  warm: { bg: colors.accentWarmTint, ink: colors.accentText },
  success: { bg: colors.successLight, ink: colors.success },
  danger: { bg: colors.dangerLight, ink: colors.danger },
  warning: { bg: colors.warningLight, ink: colors.warning },
}[tone]);

/**
 * حكاوي's bottom sheet: the app's SheetModal (swipe down, tap the dim, hardware back), with a
 * head that says what this is — a tinted icon, the title, an optional line — and a close.
 * While `busy` (an upload, a publish) it cannot be dismissed.
 */
export function Sheet({ visible, title, subtitle, icon = 'threads', tone = 'brand', onClose, children, busy }: {
  visible: boolean; title: string; subtitle?: string; icon?: IconName; tone?: Tone; onClose: () => void; children: ReactNode; busy?: boolean;
}) {
  const tint = toneOf(tone);
  return (
    <SheetModal visible={visible} onClose={() => { if (!busy) onClose(); }} avoidKeyboard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={21} color={tint.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary }}>{title}</Text>
          {subtitle ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textSecondary }}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity onPress={onClose} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="إغلاق"
          style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, opacity: busy ? 0.4 : 1 }}>
          <Icon name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={{ gap: spacing.md }}>{children}</View>
    </SheetModal>
  );
}

// A function, not a constant: theme tokens are live and change with the phone's scheme.
export const threadInputStyle = () => ({
  minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  fontFamily: fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' as const, backgroundColor: colors.surface,
});

/** A student reports another student's answer: a reason chip and an optional line. */
export function ReportSheet({ visible, reasons, pending, onClose, onSubmit }: {
  visible: boolean; reasons: Record<string, string>; pending: boolean; onClose: () => void; onSubmit: (reason: string, note: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { if (visible) { setReason(null); setNote(''); } }, [visible]);

  return (
    <Sheet visible={visible} title={t('threads.report')} subtitle={t('threads.report_hint')} icon="flag" tone="danger" onClose={onClose} busy={pending}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {Object.entries(reasons).map(([k, label]) => (
          <Choice key={k} label={label} active={reason === k} onPress={() => setReason(k)} />
        ))}
      </View>
      <TextInput value={note} onChangeText={setNote} placeholder={t('threads.report_note')} placeholderTextColor={colors.textTertiary} maxLength={500} multiline style={[threadInputStyle(), { minHeight: 72, textAlignVertical: 'top' }]} />
      <Button title={t('threads.report_send')} variant="destructive" onPress={() => reason && onSubmit(reason, note.trim())} disabled={!reason || pending} loading={pending} />
    </Sheet>
  );
}

/** One line of text the caller needs — the hide reason. */
export function TextSheet({ visible, title, subtitle, placeholder, confirm, pending, onClose, onSubmit }: {
  visible: boolean; title: string; subtitle?: string; placeholder: string; confirm: string; pending: boolean; onClose: () => void; onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(''); }, [visible]);
  return (
    <Sheet visible={visible} title={title} subtitle={subtitle} icon="eyeOff" tone="warning" onClose={onClose} busy={pending}>
      <TextInput value={text} onChangeText={setText} placeholder={placeholder} placeholderTextColor={colors.textTertiary} maxLength={160} multiline autoFocus style={[threadInputStyle(), { minHeight: 72, textAlignVertical: 'top' }]} />
      <Button title={confirm} variant="destructive" onPress={() => onSubmit(text.trim())} disabled={pending} loading={pending} />
    </Sheet>
  );
}

/** The teacher's answer: text, a video (recorded or picked, trimmed on the phone), or both. Publishing closes the round. */
export function AnswerSheet({ visible, threadId, limits, onClose, onDone }: {
  visible: boolean; threadId: number; limits: ThreadLimits | undefined; onClose: () => void; onDone: () => void;
}) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const answer = useAnswerThread(threadId);
  const draft = useVideoDraft(limits, visible);
  const busy = answer.isPending || draft.busy;
  useEffect(() => { if (visible) setBody(''); }, [visible]);

  const publish = async () => {
    try {
      const videoId = (await draft.upload())?.id ?? null;
      await answer.mutateAsync({ body: body.trim() || undefined, video_id: videoId });
      onDone();
    } catch (e) {
      Alert.alert(t('common.error'), getFriendlyErrorMessage(e));
    }
  };

  return (
    <Sheet visible={visible} title={t('threads.answer_title')} subtitle={t('threads.answer_hint')} icon="teacher" tone="success" onClose={onClose} busy={busy}>
      <TextInput value={body} onChangeText={setBody} placeholder={t('threads.answer_placeholder')} placeholderTextColor={colors.textTertiary} maxLength={4000} multiline style={[threadInputStyle(), { minHeight: 120, textAlignVertical: 'top' }]} />
      <ThreadVideoField draft={draft} label={t('threads.or_record')} />
      <Button
        title={draft.uploading !== null ? t('threads.uploading') : draft.preparing !== null ? t('threads.preparing') : t('threads.publish_answer')}
        variant="success"
        onPress={publish}
        disabled={busy || (!body.trim() && !draft.video)}
        loading={busy}
      />
    </Sheet>
  );
}

/** More time for the round. */
export function ExtendSheet({ visible, pending, onClose, onSubmit }: { visible: boolean; pending: boolean; onClose: () => void; onSubmit: (minutes: number | null) => void }) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} title={t('threads.extend_title')} subtitle={t('threads.extend_hint')} icon="timer" onClose={onClose} busy={pending}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {TIMER_PRESETS.map((p) => (
          <Choice key={p.minutes} label={t(p.key)} active={false} disabled={pending} onPress={() => onSubmit(p.minutes > 0 ? p.minutes : null)} />
        ))}
      </View>
      {pending ? <ActivityIndicator color={colors.primary} /> : null}
    </Sheet>
  );
}

/** Who watched a video, and who tried to capture it. */
export function AudienceSheet({ videoId, onClose }: { videoId: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useThreadVideoAudience(videoId, !!videoId);
  return (
    <Sheet visible={!!videoId} title={t('threads.who_watched')} icon="eye" onClose={onClose}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : !data || data.viewers.length === 0 ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary }}>{t('threads.who_watched_empty')}</Text>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Stat label={t('threads.plays', { count: data.plays_count })} tone="brand" />
            {data.capture_attempts > 0 ? <Stat label={t('threads.capture_attempts', { count: data.capture_attempts })} tone="danger" /> : null}
          </View>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' }}>
            {data.viewers.map((v, i) => (
              <View key={v.user_id} style={{ padding: spacing.md, gap: spacing.sm, borderTopWidth: i ? 1 : 0, borderTopColor: colors.borderLight, backgroundColor: v.capture_attempts ? colors.dangerLight : 'transparent' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <InitialsAvatar id={v.user_id} name={v.name} size={38} ring={v.capture_attempts ? colors.danger : null} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }} numberOfLines={1}>{v.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                      {v.student_code ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, writingDirection: 'ltr' }}>{v.student_code}</Text> : null}
                      {v.codes.slice(0, 3).map((c) => (
                        <Text key={c} style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.brand, backgroundColor: colors.brandTint, paddingHorizontal: 6, borderRadius: 6, overflow: 'hidden', writingDirection: 'ltr' }}>{c}</Text>
                      ))}
                      {v.last_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.textTertiary }}>{ago(v.last_at)}</Text> : null}
                    </View>
                  </View>
                  {v.capture_attempts ? (
                    <View style={{ minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: 14, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#FFFFFF' }}>{arDigits(v.capture_attempts)}</Text>
                    </View>
                  ) : null}
                </View>
                {/* What they tried, in red — a teacher scanning the list sees it without opening anything. */}
                {v.capture_attempts ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
                    {(v.capture_kinds.length ? v.capture_kinds : ['screenshot']).map((k) => (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, height: 26, borderRadius: radius.full, backgroundColor: colors.danger }}>
                        <Icon name={k === 'recording' ? 'video' : 'camera'} size={13} color="#FFFFFF" />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#FFFFFF' }}>{k === 'recording' ? t('threads.capture_kind_recording') : t('threads.capture_kind_screenshot')}</Text>
                      </View>
                    ))}
                    {v.last_capture_at ? <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.dangerText }}>{t('threads.capture_last', { ago: ago(v.last_capture_at) })}</Text> : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
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
    <Sheet visible={visible} title={t('threads.settings')} icon="settings" onClose={onClose}>
      <Row icon="threads" title={t('threads.settings_enabled')} hint={t('threads.settings_enabled_hint')} value={!!settings?.enabled} onChange={(v) => set({ enabled: v })} />
      <Row icon="voteDown" title={t('threads.settings_downvotes')} hint={t('threads.settings_downvotes_hint')} value={settings?.downvotes_enabled ?? true} onChange={(v) => set({ downvotes_enabled: v })} />
    </Sheet>
  );
}

/** Open reports, with the two answers a moderator has. */
export function ReportsSheet({ visible, onClose, onOpenThread }: { visible: boolean; onClose: () => void; onOpenThread: (id: number) => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useThreadReports(visible);
  const resolve = useResolveThreadReport();
  return (
    <Sheet visible={visible} title={t('threads.reports')} icon="flag" tone="warning" onClose={onClose}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : !data?.length ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
          <View style={{ width: 64, height: 64, borderRadius: 24, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield" size={30} color={colors.success} />
          </View>
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary }}>{t('threads.reports_empty')}</Text>
        </View>
      ) : data.map((r) => (
        <View key={r.id} style={{ padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <InitialsAvatar id={r.reported_user.id} name={r.reported_user.name} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.textPrimary }} numberOfLines={1}>{t('threads.report_on', { name: r.reported_user.name })}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textTertiary }} numberOfLines={1}>{t('threads.report_by', { name: r.reporter.name })}  |  {ago(r.created_at)}</Text>
            </View>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.warningLight }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.warningText }}>{r.reason_label}</Text>
            </View>
          </View>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 22, color: colors.textPrimary, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSunken }}>{r.captured_body}</Text>
          {r.note ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, color: colors.textTertiary }}>«{r.note}»</Text> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button title={r.already_hidden ? t('threads.hidden') : t('threads.report_remove')} variant="destructive" onPress={() => resolve.mutate({ reportId: r.id, action: 'remove' })} disabled={resolve.isPending} /></View>
            <View style={{ flex: 1 }}><Button title={t('threads.report_dismiss')} variant="outline" onPress={() => resolve.mutate({ reportId: r.id, action: 'dismiss' })} disabled={resolve.isPending} /></View>
            <TouchableOpacity onPress={() => onOpenThread(r.thread_id)} accessibilityLabel={t('threads.report_open')} style={{ width: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <Icon name="back" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Sheet>
  );
}

/** A selectable chip: reasons, timer presets. */
export function Choice({ label, sub, active, onPress, disabled }: { label: string; sub?: string; active: boolean; onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.8} accessibilityRole="radio" accessibilityState={{ selected: active, disabled }}
      style={{ minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: sub ? 6 : 0, borderRadius: radius.md, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brandTint : colors.surface }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: active ? colors.brand : colors.textPrimary }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: active ? colors.brand : colors.textTertiary }}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

function Row({ icon, title, hint, value, onChange }: { icon: IconName; title: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: value ? colors.brandTint : colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={value ? colors.brand : colors.textTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.textPrimary }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19, color: colors.textSecondary, marginTop: 2 }}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brand, false: colors.border }} />
    </View>
  );
}

function Stat({ label, tone }: { label: string; tone: 'brand' | 'danger' }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full, backgroundColor: tone === 'brand' ? colors.brandTint : colors.dangerLight }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: tone === 'brand' ? colors.brand : colors.dangerText }}>{label}</Text>
    </View>
  );
}
