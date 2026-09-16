import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Modal, Keyboard, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { fonts } from '@/theme/typography';
import { colors, spacing, radius, shadows, gradients } from '@/theme/index';
import { chat } from '@/theme/chat';
import { useAuthStore } from '@/stores/authStore';
import {
  useChatRoom, useSendChatMessage, useDeleteChatMessage, useReportChatMessage, useBlockChatUser, useSetChatNotify,
  useUploadChatAttachment, useChatChannels, useChatReports, useMuteChatUser, useSetChatSettings,
  mergeChatMessage, dropChatMessage,
} from '@/hooks/useChat';
import { useChatSocket } from '@/hooks/useChatSocket';
import { getChatRoom, type ChatMessage } from '@/api/chat';
import { ChatReportsSheet } from '@/components/chat/ChatReportsSheet';
import { MuteSheet } from '@/components/chat/MuteSheet';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { DateChip, isNewDay } from '@/components/chat/DateChip';
import { ChatComposer } from '@/components/chat/ChatComposer';
import type { VoiceClip } from '@/components/chat/VoiceRecorder';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { formatDateTime } from '@/utils/format';

/**
 * One course room — the SAME screen for a student and for the teacher who moderates it.
 *
 * There is one room, so there is one screen. What differs is decided by the server, not by
 * the caller: the room payload says `role`, and the moderator affordances (see the hidden
 * text, remove a message, mute a student, work the report queue, lock the room) appear only
 * when it says teacher or assistant. A second copy of this screen would be two places for
 * the safety rules to drift apart.
 *
 * Styled in Sanad, not borrowed: the warm paper canvas, the ink-indigo hero header every
 * other screen wears, and the same bubble shape a ticket thread already uses. An earlier
 * pass copied a messenger's palette wholesale and read as a clone of another app.
 *
 * What the screen never decides: who is a member, whether this person may post, what a
 * delete does, who sees a report. Every one of those is a server answer this screen repeats
 * — the `post_blocked_reason` sentence, the `mute` banner, the report reasons list. A child
 * who cannot write must always be told why (§3), so the composer is REPLACED by the reason,
 * never silently disabled.
 *
 * Transport: a private socket channel when the server has a broadcaster, with a slow poll as
 * the safety net; a fast poll while focused otherwise. FCM wakes the app either way.
 */
export function ChatRoomScreen({ courseId }: { courseId: number }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  // The socket's real state sets the poll cadence (see useChatRoom). Mirrored into state
  // because the socket hook needs the room's `realtime` settings, which the room query
  // fetches — the two hooks meet through this one flag.
  const [socketLive, setSocketLive] = useState(false);
  const room = useChatRoom(courseId, focused, socketLive);
  const channels = useChatChannels(focused);
  const send = useSendChatMessage(courseId);
  const upload = useUploadChatAttachment(courseId);
  const remove = useDeleteChatMessage(courseId);
  const report = useReportChatMessage();
  const block = useBlockChatUser(courseId);
  const setNotify = useSetChatNotify(courseId);
  const mute = useMuteChatUser(courseId);
  const setSettings = useSetChatSettings(courseId);

  // The server decides what this person is; the UI only follows. Anything below gated on
  // this is also refused server-side, so the gate is about not offering a dead button.
  const isModerator = room.data?.role === 'teacher' || room.data?.role === 'assistant';
  const reports = useChatReports(courseId, isModerator && focused);
  const openReports = reports.data?.reports?.length ?? 0;

  const [draft, setDraft] = useState('');
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [showReports, setShowReports] = useState(false);
  const [muting, setMuting] = useState<{ id: number; name: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const atBottomRef = useRef(true);
  // Scroll bookkeeping. Content height is the trigger for every auto-scroll (see
  // onContentSize) — a timer cannot know when an image finished laying out.
  const firstPaintRef = useRef(false);
  const contentHeightRef = useRef(0);
  const offsetRef = useRef(0);
  /** Content height captured just before an older page is prepended, or null. */
  const prependFromRef = useRef<number | null>(null);

  const notify = channels.data?.find((c) => c.course_id === courseId)?.notify ?? true;

  // Live frames merge into the same cache the poll fills; hidden ids drop out of it.
  const { connected, status: socketStatus } = useChatSocket(courseId, room.data?.realtime, {
    onMessage: useCallback((m: ChatMessage) => mergeChatMessage(qc, courseId, m), [qc, courseId]),
    onHidden: useCallback((id: number) => { dropChatMessage(qc, courseId, id); setOlder((prev) => prev.filter((m) => m.id !== id)); }, [qc, courseId]),
  }, focused);
  useEffect(() => { setSocketLive(connected); }, [connected]);

  // Older pages are prepended; the polled page is the tail. Dedupe by id so a message that
  // crosses the page boundary is never shown twice.
  const messages = useMemo(() => {
    const seen = new Set<number>();
    const out: ChatMessage[] = [];
    for (const m of [...older, ...(room.data?.messages ?? [])]) {
      if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
    }
    return out;
  }, [older, room.data?.messages]);

  /**
   * Every auto-scroll hangs off CONTENT SIZE, not a timer. Content settles at different
   * moments — a text bubble immediately, an image only once it has decoded and taken its
   * 232px, a whole room on first paint after layout — and a fixed delay is a guess that is
   * wrong on a slow device and wasteful on a fast one.
   */
  const onContentSize = (_w: number, h: number) => {
    const previous = contentHeightRef.current;
    contentHeightRef.current = h;

    // Arriving in the room: land on the newest message, with no visible travel.
    if (!firstPaintRef.current) {
      firstPaintRef.current = true;
      scrollRef.current?.scrollToEnd({ animated: false });
      return;
    }

    // An older page was just prepended ABOVE the reader. Hold their place: without this
    // the content they were reading jumps down by the height of the page that loaded.
    if (prependFromRef.current !== null) {
      const grew = h - prependFromRef.current;
      prependFromRef.current = null;
      if (grew > 0) scrollRef.current?.scrollTo({ y: offsetRef.current + grew, animated: false });
      return;
    }

    // Grew while the reader was at the bottom — a new message, or an image that finished
    // loading under one. Follow it. If they had scrolled up to read, never yank them.
    if (atBottomRef.current && h > previous) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    offsetRef.current = contentOffset.y;
    contentHeightRef.current = contentSize.height;
    const atBottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 120;
    atBottomRef.current = atBottom;
    if (atBottom === showJump) setShowJump(!atBottom);
  };

  // Opening the keyboard shrinks the viewport from the bottom, which is exactly where the
  // newest message is. Follow it up, or the message just sent sits behind the keyboard.
  useEffect(() => {
    const evt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(evt, () => {
      if (atBottomRef.current) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      }
    });
    return () => sub.remove();
  }, []);

  const loadOlder = async () => {
    const first = messages[0];
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await getChatRoom(courseId, first.id);
      if (page.messages.length === 0) setNoMoreOlder(true);
      // Remember where we were, so onContentSize can put the reader back.
      prependFromRef.current = contentHeightRef.current;
      setOlder((prev) => [...page.messages, ...prev]);
    } catch {
      // Silent: the button stays, the reader can try again.
    } finally {
      setLoadingOlder(false);
    }
  };

  const doSend = () => {
    const text = draft.trim();
    if (!text || send.isPending) return;
    send.mutate(text, {
      onSuccess: () => { setDraft(''); atBottomRef.current = true; },
      onError: (err) => Alert.alert(t('chat.failed'), getFriendlyErrorMessage(err)),
    });
  };

  // ── Attachments (§8) — all through one upload door, caption = whatever is in the box ──
  const sendAttachment = (input: { kind: 'image' | 'file' | 'voice'; uri: string; name: string; mime: string; duration?: number }) => {
    upload.mutate({ ...input, body: draft.trim() || undefined }, {
      onSuccess: () => { setDraft(''); atBottomRef.current = true; },
      onError: (err) => Alert.alert(t('chat.failed'), getFriendlyErrorMessage(err)),
    });
  };

  const tooBig = (size: number | undefined, maxKb: number | undefined) => {
    if (!size || !maxKb) return false;
    if (size > maxKb * 1024) {
      Alert.alert('', t('chat.attachment_too_big', { mb: Math.round((maxKb / 1024) * 10) / 10 }));
      return true;
    }
    return false;
  };

  const pickImage = async (camera: boolean) => {
    try {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.75, allowsEditing: false, exif: false };
      const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (tooBig(a.fileSize, room.data?.limits?.image_max_kb)) return;
      sendAttachment({ kind: 'image', uri: a.uri, name: a.fileName ?? 'photo.jpg', mime: a.mimeType ?? 'image/jpeg' });
    } catch (err) {
      Alert.alert('', getFriendlyErrorMessage(err));
    }
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false, type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/csv'] });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (tooBig(a.size, room.data?.limits?.file_max_kb)) return;
      sendAttachment({ kind: 'file', uri: a.uri, name: a.name, mime: a.mimeType ?? 'application/octet-stream' });
    } catch (err) {
      Alert.alert('', getFriendlyErrorMessage(err));
    }
  };

  const attachMenu = () => {
    Alert.alert(t('chat.attach'), undefined, [
      { text: t('chat.attach_photo'), onPress: () => { void pickImage(false); } },
      { text: t('chat.attach_file'), onPress: () => { void pickFile(); } },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const onVoiceClip = (clip: VoiceClip) => {
    sendAttachment({ kind: 'voice', uri: clip.uri, name: clip.name, mime: clip.mime, duration: clip.duration });
  };

  /**
   * Long-press menu. Own message → withdraw. Someone else's → a MODERATOR removes it from
   * the room or stops that student writing; everyone else reports it to the teacher or hides
   * the member from their own view. The two menus never mix: offering a student "remove for
   * everyone" would be a button that always fails.
   */
  const onMessageMenu = (m: ChatMessage) => {
    const mine = m.sender.id === me?.id;
    if (mine) {
      Alert.alert(t('chat.message_actions'), t('chat.delete_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.delete_action'), style: 'destructive', onPress: () => remove.mutate(m.id, {
          onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
        }) },
      ]);
      return;
    }

    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];

    if (isModerator) {
      if (!m.hidden) {
        buttons.push({
          text: t('chat.remove_message'),
          style: 'destructive',
          onPress: () => Alert.alert(t('chat.remove_message'), t('chat.remove_confirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('chat.remove_action'), style: 'destructive', onPress: () => remove.mutate(m.id, {
              onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
            }) },
          ]),
        });
      }
      // A teacher or assistant cannot be muted — the server refuses, so do not offer it.
      if (!m.sender.is_staff) {
        buttons.push({ text: t('chat.mute_writing'), onPress: () => setMuting({ id: m.sender.id, name: m.sender.name }) });
      }
    } else {
      buttons.push({ text: t('chat.report'), onPress: () => { setReporting(m); setReportReason(null); setReportNote(''); } });
      // Staff cannot be hidden (§4) — the server refuses too; better not to offer it.
      if (!m.sender.is_staff) {
        buttons.push({ text: t('chat.block'), style: 'destructive', onPress: () => confirmBlock(m) });
      }
    }

    buttons.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(m.sender.name, undefined, buttons);
  };

  /** The moderator's room-wide switches. Neither singles out a student. */
  const roomMenu = () => {
    if (!room.data) return;
    const locked = room.data.locked;
    const announce = room.data.announcements_only;
    Alert.alert(t('chat.room_settings'), t('chat.room_settings_hint'), [
      {
        text: locked ? t('chat.unlock_room') : t('chat.lock_room'),
        onPress: () => setSettings.mutate({ is_locked: !locked }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }),
      },
      {
        text: announce ? t('chat.announcements_off') : t('chat.announcements_on'),
        onPress: () => setSettings.mutate({ announcements_only: !announce }, { onError: (e) => Alert.alert('', getFriendlyErrorMessage(e)) }),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const confirmBlock = (m: ChatMessage) => {
    Alert.alert(t('chat.block_confirm_title', { name: m.sender.name }), t('chat.block_confirm_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.block_action'), style: 'destructive', onPress: () => block.mutate(m.sender.id, {
        onSuccess: (msg) => { setOlder((prev) => prev.filter((x) => x.sender.id !== m.sender.id)); Alert.alert('', msg); },
        onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
      }) },
    ]);
  };

  const submitReport = () => {
    if (!reporting || !reportReason || report.isPending) return;
    report.mutate({ messageId: reporting.id, reason: reportReason, note: reportNote.trim() || undefined }, {
      onSuccess: (msg) => { setReporting(null); Alert.alert('', msg); },
      onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
    });
  };

  const toggleNotify = () => {
    const next = !notify;
    setNotify.mutate(next, { onSuccess: () => Alert.alert('', next ? t('chat.notify_on') : t('chat.notify_off')) });
  };

  if (room.isLoading && !room.data) {
    return (
      <View style={{ flex: 1, backgroundColor: chat.canvas, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!room.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ErrorState onRetry={() => room.refetch()} />
      </View>
    );
  }

  const data = room.data;
  const reasons = Object.entries(data.report_reasons ?? {});
  const busy = send.isPending || upload.isPending;
  const previewFor = (m: ChatMessage) => (m.body && m.body.trim() !== '' ? m.body : m.attachment ? (m.attachment.kind === 'image' ? t('chat.photo') : m.attachment.kind === 'voice' ? t('chat.voice_note') : (m.attachment.name ?? t('chat.file'))) : '');

  return (
    <View style={{ flex: 1, backgroundColor: chat.canvas }}>
      {/* Header — the same ink hero band every other screen in the app wears. */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
          paddingTop: insets.top + spacing.sm, paddingBottom: spacing.md, paddingHorizontal: spacing.sm,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon name="forward" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }}>
            {(data.course.name || '؟').trim().charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: '#fff' }} numberOfLines={1}>{data.course.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {/* The dot is the socket's word, not a guess: green only once the private channel is
                subscribed; amber while it tries or after it failed (the poll carries the room then). */}
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connected ? '#8FE3A2' : (socketStatus === 'off' ? 'rgba(255,255,255,0.35)' : '#F3C969') }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>
              {`${connected ? t('chat.live') : t('chat.polling')} · ${t('chat.members_count', { count: data.course.members })}`}
            </Text>
          </View>
        </View>
        {isModerator ? (
          <TouchableOpacity
            onPress={() => setShowReports(true)}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={t('chat.reports_title')}
          >
            <Icon name="flag" size={21} color="#fff" outline={openReports === 0} />
            {openReports > 0 ? (
              <View style={{ position: 'absolute', top: 6, end: 4, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#fff' }}>{openReports > 9 ? '9+' : openReports}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={toggleNotify} disabled={setNotify.isPending} style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={notify ? t('chat.notify_on') : t('chat.notify_off')}>
          <Icon name={notify ? 'bell' : 'bellOff'} size={21} color={notify ? '#fff' : 'rgba(255,255,255,0.6)'} outline />
        </TouchableOpacity>
        {isModerator ? (
          <TouchableOpacity onPress={roomMenu} style={{ width: 34, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('chat.room_settings')}>
            <Icon name="settings" size={20} color="#fff" outline />
          </TouchableOpacity>
        ) : null}
      </LinearGradient>

      {(data.locked || data.announcements_only) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.warningLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <Icon name={data.locked ? 'lock' : 'info'} size={15} color={colors.warningText} outline />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warningText }}>
            {data.locked ? t('chat.locked') : t('chat.announcements')}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ flex: 1 }}>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexGrow: 1, justifyContent: 'flex-end' }}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            onContentSizeChange={onContentSize}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length >= (data.page_size || 50) && !noMoreOlder ? (
              <TouchableOpacity onPress={loadOlder} disabled={loadingOlder} style={{ alignSelf: 'center', paddingVertical: 7, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: chat.chipBg, borderWidth: 1, borderColor: chat.chipBorder, marginBottom: spacing.sm }}>
                {loadingOlder ? <ActivityIndicator size="small" color={colors.primary} /> : (
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: chat.chipText }}>{t('chat.load_older')}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            {messages.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl4 }}>
                <View style={{ backgroundColor: chat.chipBg, borderWidth: 1, borderColor: chat.chipBorder, borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, maxWidth: 300 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center' }}>
                    {t('chat.no_messages_title')}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>
                    {t('chat.no_messages_body')}
                  </Text>
                </View>
              </View>
            ) : (
              messages.map((m, i) => {
                const prev = messages[i - 1];
                const mine = m.sender.id === me?.id;
                const newDay = isNewDay(prev?.created_at, m.created_at);
                // A run of messages from one sender shows the name once and the tail once.
                const sameRun = !!prev && prev.sender.id === m.sender.id && !newDay;
                const next = messages[i + 1];
                const runEnds = !next || next.sender.id !== m.sender.id || isNewDay(m.created_at, next.created_at);

                return (
                  <View key={m.id}>
                    {newDay ? <DateChip date={m.created_at} /> : null}
                    <ChatBubble
                      message={m}
                      mine={mine}
                      showName={!sameRun}
                      showTail={runEnds}
                      onLongPress={onMessageMenu}
                    />
                  </View>
                );
              })
            )}

            {upload.isPending ? (
              <View style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandTint, borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: spacing.md, marginTop: spacing.sm, opacity: 0.85 }}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.brand }}>{t('chat.uploading')}</Text>
              </View>
            ) : null}
          </ScrollView>

          {showJump && messages.length > 0 ? (
            <TouchableOpacity
              onPress={() => scrollRef.current?.scrollToEnd({ animated: true })}
              accessibilityRole="button"
              accessibilityLabel={t('chat.jump_to_latest')}
              style={{
                position: 'absolute', bottom: spacing.md, end: spacing.md,
                width: 42, height: 42, borderRadius: 21,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center', ...shadows.md,
              }}
            >
              <Icon name="down" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {data.mute ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningLight, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, paddingBottom: spacing.md + insets.bottom }}>
            <Icon name="mute" size={18} color={colors.warningText} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 21, color: colors.warningText }}>
              {t('chat.muted_banner', { until: formatDateTime(data.mute.until), reason: data.mute.reason })}
            </Text>
          </View>
        ) : data.can_post ? (
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={doSend}
            onAttach={attachMenu}
            onCamera={() => { void pickImage(true); }}
            onVoiceClip={onVoiceClip}
            voiceMaxSeconds={data.limits?.voice_max_seconds || 120}
            sending={busy}
            recording={recording}
            onRecordingChange={setRecording}
            bottomInset={insets.bottom}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, paddingBottom: spacing.lg + insets.bottom, backgroundColor: chat.bar, borderTopWidth: 1, borderTopColor: chat.barBorder }}>
            <Icon name="lock" size={16} color={colors.textTertiary} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 21, color: colors.textSecondary }}>
              {data.post_blocked_reason}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* The moderator's queue and the mute sheet — rendered only for a moderator, and
          refused server-side for anyone else regardless. */}
      {isModerator ? (
        <>
          <ChatReportsSheet
            visible={showReports}
            onClose={() => setShowReports(false)}
            courseId={courseId}
            reports={reports.data?.reports ?? []}
            muteMaxHours={reports.data?.mute_max_hours ?? 72}
            loading={reports.isLoading}
          />
          <MuteSheet
            target={muting}
            maxHours={reports.data?.mute_max_hours ?? 72}
            pending={mute.isPending}
            onClose={() => setMuting(null)}
            onSubmit={(hours, reason) => {
              if (!muting) return;
              mute.mutate({ userId: muting.id, hours, reason }, {
                onSuccess: (msg) => { setMuting(null); Alert.alert('', msg); },
                onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)),
              });
            }}
          />
        </>
      ) : null}

      {/* Report a message to the teacher (§5). Reasons come from the server; no report id comes back. */}
      <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={() => setReporting(null)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.xl, paddingBottom: spacing.xl + insets.bottom }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.textPrimary, textAlign: 'right' }}>{t('chat.report_title')}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSecondary, textAlign: 'right', marginTop: spacing.xs }}>
              {t('chat.report_hint')}
            </Text>
            {reporting ? (
              <View style={{ backgroundColor: colors.surfaceSunken, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderStartWidth: 3, borderStartColor: colors.border }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textTertiary, textAlign: 'right' }}>{reporting.sender.name}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: 'right' }} numberOfLines={3}>{previewFor(reporting)}</Text>
              </View>
            ) : null}

            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.textPrimary, textAlign: 'right', marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('chat.report_reason')}</Text>
            <View style={{ gap: spacing.xs }}>
              {reasons.map(([key, label]) => {
                const on = reportReason === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setReportReason(key)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? colors.brand : colors.border, backgroundColor: on ? colors.brandTint : colors.surface }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.brand : colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand }} /> : null}
                    </View>
                    <Text style={{ flex: 1, fontFamily: on ? fonts.bold : fonts.regular, fontSize: 15, color: colors.textPrimary, textAlign: 'right' }}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={reportNote}
              onChangeText={setReportNote}
              placeholder={t('chat.report_note')}
              placeholderTextColor={colors.textTertiary}
              multiline
              maxLength={1000}
              style={{ marginTop: spacing.md, fontFamily: fonts.regular, fontSize: 15, minHeight: 64, maxHeight: 120, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: 12, color: colors.textPrimary, textAlign: 'right' }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <TouchableOpacity onPress={() => setReporting(null)} style={{ flex: 1, minHeight: 50, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSecondary }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={submitReport} disabled={!reportReason || report.isPending} activeOpacity={0.85} style={{ flex: 1.4, minHeight: 50, borderRadius: radius.lg, backgroundColor: reportReason ? colors.danger : colors.border, justifyContent: 'center', alignItems: 'center' }}>
                {report.isPending ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{t('chat.report_send')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
