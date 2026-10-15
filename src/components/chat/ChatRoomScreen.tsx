import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Keyboard, ActivityIndicator, Alert, type NativeScrollEvent, type NativeSyntheticEvent, type ViewToken } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AppModal as Modal } from '@/ui/AppModal';
import { useTranslation } from 'react-i18next';
import { router, type Href } from 'expo-router';
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
  useChatRoom, useDeleteChatMessage, useReportChatMessage, useBlockChatUser, useSetChatNotify,
  useChatChannels, useChatReports, useMuteChatUser, useSetChatSettings,
  mergeChatMessage, dropChatMessage,
} from '@/hooks/useChat';
import { discardChatOutbox, enqueueChatMessage, flushChatOutbox, retryChatOutbox, useChatOutbox } from '@/chat/outbox';
import { mergeOutbox } from '@/chat/outboxCore';
import { useOfflineStore } from '@/stores/offlineStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { attachmentFileName, getChatRoom, postChatTyping, reactChatMessage, type ChatMessage, type ChatReaction, type ChatReplyRef, type ChatRoom } from '@/api/chat';
import { MessageActionsOverlay, type MessageAction } from '@/components/chat/MessageActionsOverlay';
import type { BubbleRect } from '@/components/chat/ChatBubble';
import { ChatReportsSheet } from '@/components/chat/ChatReportsSheet';
import { MuteSheet } from '@/components/chat/MuteSheet';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/ErrorState';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { DateChip } from '@/components/chat/DateChip';
import { ChatCalendarSheet } from '@/components/chat/ChatCalendarSheet';
import { buildRows, dayKey, lastServerId, mergeById, seenFor, type RoomRow } from '@/chat/roomView';
import { useChatJump } from '@/chat/jumpStore';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatWallpaper } from '@/components/chat/ChatWallpaper';
import { TypingBubble } from '@/components/chat/TypingBubble';
import type { VoiceClip } from '@/components/chat/VoiceRecorder';
import { getFriendlyErrorMessage } from '@/utils/errors';
import { useKeyboardDropOnLeave } from '@/hooks/useKeyboardDropOnLeave';
import { isParentsRoom, roomIdOf, type RoomId } from '@/chat/room';
import { RoomAvatar } from '@/components/chat/RoomAvatar';
import { RoomSwitcher } from '@/components/chat/RoomSwitcher';
import { formatDateTime, formatDayDate, relativeDay } from '@/utils/format';

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
export function ChatRoomScreen({ courseId, infoHref, roomHref }: {
  courseId: number;
  /** The room's info page for this role (members, moderators, the shelf, the calendar). */
  infoHref?: string;
  /** Another room's address for this role — the header's switcher swaps rooms in place. */
  roomHref?: (room: RoomId) => string;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  useKeyboardDropOnLeave();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  // The socket's real state sets the poll cadence (see useChatRoom). Mirrored into state
  // because the socket hook needs the room's `realtime` settings, which the room query
  // fetches — the two hooks meet through this one flag.
  const [socketLive, setSocketLive] = useState(false);
  const room = useChatRoom(courseId, focused, socketLive);
  const channels = useChatChannels(focused);
  // What this phone sent that the server does not have yet — on disk, sent by itself (outbox.ts).
  const outboxItems = useChatOutbox((s) => s.items);
  const online = useOfflineStore((s) => s.online);
  useEffect(() => { void flushChatOutbox(); }, [courseId]);
  const remove = useDeleteChatMessage(courseId);
  const report = useReportChatMessage();
  const block = useBlockChatUser(courseId);
  const setNotify = useSetChatNotify(courseId);
  const mute = useMuteChatUser(courseId);
  const setSettings = useSetChatSettings(courseId);

  // The server decides what this person is; the UI only follows. Anything below gated on
  // this is also refused server-side, so the gate is about not offering a dead button.
  const isModerator = room.data?.role === 'teacher' || room.data?.role === 'assistant';
  // A parent following their child's room (founder 2026-10-12): reads everything, writes,
  // reacts and replies nothing — the server refuses all three; the room does not offer them.
  const observer = room.data?.role === 'observer';
  const parentsRoom = isParentsRoom(courseId);
  const reports = useChatReports(courseId, isModerator && focused);
  const openReports = reports.data?.reports?.length ?? 0;

  const [draft, setDraft] = useState('');
  // «يكتب…» — who is typing right now, by user id, with the moment their last frame goes
  // stale. A frame is a nicety: nothing here is stored, and a lost one costs nothing.
  const [typers, setTypers] = useState<Record<number, { name: string; until: number }>>({});
  const typingSentAt = useRef(0);
  // A typing frame that left just before its sender's message can land just after it, and a
  // poll can still list them: «يكتب…» came back under a message already sent (founder
  // 2026-10-15). Remember when each member's message arrived and ignore typing for a moment.
  const lastSentBy = useRef<Record<number, number>>({});
  const justSent = (userId: number) => Date.now() - (lastSentBy.current[userId] ?? 0) < 3000;
  const onTyping = useCallback((tp: { user_id: number; name: string }) => {
    if (me && tp.user_id === me.id) return; // my own frame comes back too
    if (justSent(tp.user_id)) return;
    setTypers((prev) => ({ ...prev, [tp.user_id]: { name: tp.name || '…', until: Date.now() + 4000 } }));
  }, [me]);
  const forgetTyper = useCallback((userId: number) => {
    lastSentBy.current[userId] = Date.now();
    setTypers((prev) => { if (!prev[userId]) return prev; const next = { ...prev }; delete next[userId]; return next; });
  }, []);
  useEffect(() => {
    if (!Object.keys(typers).length) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTypers((prev) => {
        const next: typeof prev = {};
        let changed = false;
        for (const k of Object.keys(prev)) { const e = prev[Number(k)]; if (e.until > now) next[Number(k)] = e; else changed = true; }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [typers]);
  // Without a socket the room payload carries who was typing in the last seconds (polled).
  // With one, the frames are fresher — a poll's list is seconds old and re-added «يكتب…» for
  // someone whose message had just arrived (the web room already worked this way).
  const polledTyping = room.data?.typing;
  const [socketUp, setSocketUp] = useState(false);
  useEffect(() => {
    if (socketUp || !polledTyping?.length) return;
    setTypers((prev) => {
      const next = { ...prev };
      for (const tp of polledTyping) { if ((!me || tp.user_id !== me.id) && !justSent(tp.user_id)) next[tp.user_id] = { name: tp.name || '…', until: Date.now() + 5000 }; }
      return next;
    });
  }, [polledTyping, me, socketUp]);
  const typingLabel = useMemo(() => {
    const names = Object.values(typers).map((x) => x.name);
    if (!names.length) return null;
    return names.length === 1 ? t('chat.typing_one', { name: names[0] }) : t('chat.typing_many');
  }, [typers, t]);
  // A read frame moves someone's cursor: refetch once, soon, so the ticks turn.
  const readRefetch = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRead = useCallback(() => {
    if (readRefetch.current) return;
    readRefetch.current = setTimeout(() => { readRefetch.current = null; void room.refetch(); }, 800);
  }, [room]);
  const [recording, setRecording] = useState(false);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportNote, setReportNote] = useState('');
  const [showReports, setShowReports] = useState(false);
  const [muting, setMuting] = useState<{ id: number; name: string } | null>(null);
  // Swipe-to-reply: the message the composer is answering.
  const [replyTo, setReplyTo] = useState<ChatReplyRef | null>(null);
  // Hold: the message lifted in the overlay, with its place on screen.
  const [held, setHeld] = useState<{ message: ChatMessage; rect: BubbleRect } | null>(null);
  // Reactions newer than the messages that carry them — from polls, socket frames and my own
  // taps — keyed by message id, so older pages and history windows turn too.
  const [reactionOverrides, setReactionOverrides] = useState<Record<number, ChatReaction[]>>({});

  // ── The list ─────────────────────────────────────────────────────────────────────────
  // INVERTED (newest at index 0, the bottom): it sticks to the newest message, keeps its
  // place when older pages load above, and can open any day of the past without measuring
  // everything in between (founder 2026-10-12, «see the conversation by dates, like
  // Telegram»). Two modes: the LIVE room (older pages + the polled tail + the outbox), or a
  // WINDOW of history around a jumped-to message, which pages both ways and becomes the
  // live room again when it reaches the present.
  const listRef = useRef<FlatList<RoomRow>>(null);
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [win, setWin] = useState<{ messages: ChatMessage[]; hasMoreBefore: boolean; hasMoreAfter: boolean } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMoreOlder, setNoMoreOlder] = useState(false);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [pendingScrollId, setPendingScrollId] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pill, setPill] = useState<{ date: string; visible: boolean }>({ date: '', visible: false });
  const pillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRetries = useRef(0);

  const notify = channels.data?.find((c) => roomIdOf(c) === courseId)?.notify ?? true;
  // The switcher: every other room one tap away, with what is waiting in them.
  const [switching, setSwitching] = useState(false);
  const elsewhereUnread = (channels.data ?? []).reduce((n, c) => n + (roomIdOf(c) === courseId ? 0 : c.unread || 0), 0);
  const roomsCount = channels.data?.length ?? 0;

  // Live frames merge into the same cache the poll fills; hidden ids drop out of it.
  const { connected, status: socketStatus } = useChatSocket(courseId, room.data?.realtime, {
    onMessage: useCallback((m: ChatMessage) => { mergeChatMessage(qc, courseId, m); forgetTyper(m.sender.id); }, [qc, courseId, forgetTyper]),
    onHidden: useCallback((id: number) => {
      dropChatMessage(qc, courseId, id);
      setOlder((prev) => prev.filter((m) => m.id !== id));
      setWin((w) => (w ? { ...w, messages: w.messages.filter((m) => m.id !== id) } : w));
    }, [qc, courseId]),
    onTyping,
    onRead,
    onReaction: useCallback((r: { message_id: number; reactions: ChatReaction[] }) => {
      setReactionOverrides((prev) => ({ ...prev, [r.message_id]: r.reactions }));
    }, []),
  }, focused);
  useEffect(() => { setSocketLive(connected); setSocketUp(connected); }, [connected]);
  // One small frame every few seconds while typing — and only when a socket is there to
  // carry it; without one nobody could see the indicator anyway.
  const onDraftChange = (v: string) => {
    setDraft(v);
    const now = Date.now();
    // Sent whether or not a socket is up: the server remembers it for the others' next poll.
    if (v && now - typingSentAt.current > 3000) {
      typingSentAt.current = now;
      postChatTyping(courseId).catch(() => undefined);
    }
  };

  // My messages' ticks come from the room's read thresholds (they turn without the old
  // messages being sent again); the outbox is drawn after the server's messages.
  const seenSome = room.data?.seen_upto?.some;
  const seenAll = room.data?.seen_upto?.all;
  const messages = useMemo(() => {
    const base = win ? win.messages : mergeOutbox(mergeById(older, room.data?.messages ?? []), outboxItems, courseId);
    const upto = seenSome !== undefined && seenAll !== undefined ? { some: seenSome, all: seenAll } : null;
    const hasOverrides = Object.keys(reactionOverrides).length > 0;
    if ((!me || !upto) && !hasOverrides) return base;
    return base.map((m) => {
      let out = m;
      if (hasOverrides && reactionOverrides[m.id]) out = { ...out, reactions: reactionOverrides[m.id] };
      if (me && upto && m.sender.id === me.id && !m.local) out = { ...out, seen: seenFor(m, upto) };
      return out;
    });
  }, [win, older, room.data?.messages, outboxItems, courseId, me, seenSome, seenAll, reactionOverrides]);

  // Reaction changes a poll reports on messages it did not resend; a full page is the truth
  // for what it carries, so its messages drop their overrides.
  const pollData = room.data;
  useEffect(() => {
    if (!pollData) return;
    setReactionOverrides((prev) => {
      let next = prev;
      if (pollData.window?.mode !== 'after' && Object.keys(prev).length) {
        next = { ...prev };
        for (const m of pollData.messages) delete next[m.id];
      }
      const updates = pollData.reaction_updates;
      if (updates && Object.keys(updates).length) {
        next = next === prev ? { ...prev } : next;
        for (const [id, summary] of Object.entries(updates)) next[Number(id)] = summary;
      }
      return next;
    });
  }, [pollData]);
  const rows = useMemo(() => buildRows(messages).reverse(), [messages]);
  const rowKeyExtractor = useCallback((r: RoomRow) => r.key, []);
  const waiting = useMemo(() => outboxItems.filter((x) => x.courseId === courseId && x.status !== 'failed').length, [outboxItems, courseId]);
  const pageSize = room.data?.page_size || 50;

  const loadOlder = useCallback(async () => {
    if (loadingOlder) return;
    const first = messages.find((m) => m.id > 0);
    if (!first) return;
    if (win ? !win.hasMoreBefore : (noMoreOlder || messages.length < pageSize)) return;
    setLoadingOlder(true);
    try {
      const page = await getChatRoom(courseId, { beforeId: first.id });
      const more = page.messages.length >= pageSize;
      if (win) setWin((w) => (w ? { ...w, messages: mergeById(page.messages, w.messages), hasMoreBefore: more } : w));
      else { if (!more) setNoMoreOlder(true); setOlder((prev) => mergeById(page.messages, prev)); }
    } catch {
      // Silent: scrolling up again tries again.
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, messages, win, noMoreOlder, pageSize, courseId]);

  /** Below a jumped-to day: the next page toward the present — and the present itself, once reached. */
  const loadNewer = useCallback(async () => {
    if (!win || !win.hasMoreAfter || loadingNewer) return;
    setLoadingNewer(true);
    try {
      const page = await getChatRoom(courseId, { afterId: lastServerId(win.messages) });
      const merged = mergeById(win.messages, page.messages);
      if (page.window?.mode === 'after' && page.window.has_more_after) setWin({ ...win, messages: merged });
      else { setOlder(merged); setNoMoreOlder(!win.hasMoreBefore); setWin(null); }
    } catch {
      // Silent: scrolling down again tries again.
    } finally {
      setLoadingNewer(false);
    }
  }, [win, loadingNewer, courseId]);

  /** Open the room at one message («show in chat») or at a day's first message (the calendar). */
  const jumpTo = useCallback(async (q: { aroundId?: number; aroundDate?: string }) => {
    if (q.aroundId && !win && messages.some((m) => m.id === q.aroundId)) { setPendingScrollId(q.aroundId); return; }
    try {
      const page = await getChatRoom(courseId, q);
      if (page.window?.mode !== 'around') { Alert.alert('', t('chat.jump_unavailable')); return; }
      const anchor = page.window.anchor_id ?? null;
      if (page.window.has_more_after) {
        setWin({ messages: page.messages, hasMoreBefore: !!page.window.has_more_before, hasMoreAfter: true });
      } else {
        setWin(null);
        setOlder(page.messages);
        setNoMoreOlder(!page.window.has_more_before);
      }
      if (anchor) setPendingScrollId(anchor);
    } catch (err) {
      Alert.alert('', getFriendlyErrorMessage(err));
    }
  }, [win, messages, courseId, t]);

  /** Back to the newest message — out of any history window. */
  const toLatest = useCallback(() => {
    if (win) { setWin(null); setOlder([]); setNoMoreOlder(false); }
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }, [win]);

  // Scroll to a jumped-to message once it is in the rows, and let it glow.
  useEffect(() => {
    if (pendingScrollId == null) return;
    const index = rows.findIndex((r) => r.type === 'msg' && r.message.id === pendingScrollId);
    if (index < 0) return;
    const id = pendingScrollId;
    setPendingScrollId(null);
    scrollRetries.current = 0;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      setHighlightId(id);
      setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 2400);
    });
  }, [pendingScrollId, rows]);
  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    if (scrollRetries.current++ > 3) return;
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 140);
  }, []);

  // «Show in chat» / a day picked on the info page: the room picks the request up on focus.
  const jumpReq = useChatJump((st) => st.request);
  useEffect(() => {
    if (!jumpReq || jumpReq.courseId !== courseId || !focused) return;
    useChatJump.getState().clear(jumpReq.nonce);
    if (jumpReq.latest) toLatest();
    else void jumpTo(jumpReq.messageId ? { aroundId: jumpReq.messageId } : { aroundDate: jumpReq.date });
  }, [jumpReq, courseId, focused, toLatest, jumpTo]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const far = e.nativeEvent.contentOffset.y > 500; // inverted: the offset is the distance from the newest
    setShowJump((v) => (v === far ? v : far));
  }, []);

  // The floating date: the day at the top of the screen, shown while the list moves (and
  // for as long as the room shows the past). Tap it for the calendar.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<RoomRow>[] }) => {
    let top: RoomRow | null = null;
    let topIndex = -1;
    for (const v of viewableItems) {
      if (v.index != null && v.index > topIndex && v.item) { topIndex = v.index; top = v.item; }
    }
    if (!top) return;
    const date = top.type === 'msg' ? top.message.created_at : top.date;
    setPill((p) => (p.date && dayKey(p.date) === dayKey(date) ? p : { ...p, date }));
  }).current;
  const showPill = useCallback(() => {
    if (pillTimer.current) clearTimeout(pillTimer.current);
    setPill((p) => (p.visible ? p : { ...p, visible: true }));
  }, []);
  const hidePillSoon = useCallback(() => {
    if (pillTimer.current) clearTimeout(pillTimer.current);
    pillTimer.current = setTimeout(() => setPill((p) => ({ ...p, visible: false })), 1400);
  }, []);
  useEffect(() => () => { if (pillTimer.current) clearTimeout(pillTimer.current); }, []);

  // Send = write to the outbox. The bubble is in the room the instant you tap (the outbox is
  // part of the list), the box clears, and the outbox sends it — now, or when there is a
  // network again. No pending gate: three short messages in a row each get their own bubble.
  // A refusal is shown IN the bubble with a retry, not as an alert over the conversation.
  const sender = useMemo(() => ({
    id: me?.id ?? -1, name: me?.name ?? '',
    is_staff: room.data?.role === 'teacher' || room.data?.role === 'assistant',
    is_teacher: room.data?.role === 'teacher',
  }), [me?.id, me?.name, room.data?.role]);
  const doSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    toLatest();
    enqueueChatMessage({ courseId, body: text, sender, replyTo });
    setReplyTo(null);
  };

  // ── Attachments (§8) — all through one upload door, caption = whatever is in the box ──
  const sendAttachment = (input: { kind: 'image' | 'file' | 'voice'; uri: string; name: string; mime: string; duration?: number; size?: number; meta?: { width?: number; height?: number } | null }) => {
    const body = draft.trim() || null;
    setDraft('');
    toLatest();
    enqueueChatMessage({ courseId, body, attachment: input, sender, replyTo });
    setReplyTo(null);
  };

  // A message the server refused. The retry under the bubble sends it again; the long
  // menu also offers to let it go.
  const onRetry = (m: ChatMessage) => {
    if (!m.local) return;
    retryChatOutbox(m.local.key);
  };
  const onDiscard = (m: ChatMessage) => {
    if (!m.local) return;
    const key = m.local.key;
    Alert.alert(t('chat.failed'), m.local.status === 'failed' ? t('chat.not_sent_short') : t('chat.queued_offline'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('chat.discard'), style: 'destructive', onPress: () => discardChatOutbox(key) },
      ...(m.local.status === 'failed' ? [{ text: t('chat.retry'), onPress: () => onRetry(m) }] : []),
    ]);
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
      const ext = (a.fileName ?? a.uri).split('.').pop() || 'jpg';
      sendAttachment({
        kind: 'image', uri: a.uri, name: attachmentFileName('image', null, ext), mime: a.mimeType ?? 'image/jpeg',
        size: a.fileSize ?? undefined, meta: a.width && a.height ? { width: a.width, height: a.height } : null,
      });
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
      sendAttachment({ kind: 'file', uri: a.uri, name: attachmentFileName('file', a.name, a.name.split('.').pop() || 'bin'), mime: a.mimeType ?? 'application/octet-stream', size: a.size ?? undefined });
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
    if (m.local) { onDiscard(m); return; } // not on the server yet: nothing to delete there
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

  /** What a quote shows of a message: its text, or what kind of thing it is. */
  const quoteOf = useCallback((m: ChatMessage): ChatReplyRef => ({
    id: m.id, sender_id: m.sender.id, sender_name: m.sender.name, kind: m.kind, hidden: false,
    preview: m.body && m.body.trim() !== '' ? m.body.trim().slice(0, 140)
      : m.attachment ? (m.attachment.kind === 'image' ? t('chat.photo') : m.attachment.kind === 'voice' ? t('chat.voice_note') : (m.attachment.name ?? t('chat.file'))) : '',
  }), [t]);
  const startReply = useCallback((m: ChatMessage) => { setReplyTo(quoteOf(m)); }, [quoteOf]);

  /** Add, switch or take back my reaction — on screen at once, the server's answer after. */
  const react = useCallback((m: ChatMessage, emoji: string) => {
    if (!me || m.id <= 0) return;
    const current = m.reactions ?? [];
    const mineNow = current.find((r) => r.user_ids.includes(me.id))?.emoji ?? null;
    const nextEmoji = mineNow === emoji ? null : emoji;
    const optimistic = current
      .map((r) => ({ ...r, user_ids: r.user_ids.filter((u) => u !== me.id) }))
      .map((r) => (r.emoji === nextEmoji ? { ...r, user_ids: [...r.user_ids, me.id] } : r));
    if (nextEmoji && !optimistic.some((r) => r.emoji === nextEmoji)) optimistic.push({ emoji: nextEmoji, count: 0, user_ids: [me.id] });
    const summary = optimistic.map((r) => ({ ...r, count: r.user_ids.length })).filter((r) => r.count > 0);
    setReactionOverrides((prev) => ({ ...prev, [m.id]: summary }));
    reactChatMessage(m.id, nextEmoji)
      .then((server) => setReactionOverrides((prev) => ({ ...prev, [m.id]: server })))
      .catch((err) => {
        setReactionOverrides((prev) => ({ ...prev, [m.id]: current }));
        Alert.alert('', getFriendlyErrorMessage(err));
      });
  }, [me]);

  /** Hold: the overlay (reactions + actions), or — for a message still in the outbox — retry / let go. */
  const onHold = useCallback((m: ChatMessage, rect?: BubbleRect) => {
    if (m.local) { onDiscardRef.current(m); return; }
    if (!rect) { menuRef.current(m); return; }
    setHeld({ message: m, rect });
  }, []);
  const heldActions = (m: ChatMessage): MessageAction[] => {
    const close = (fn: () => void) => () => { setHeld(null); fn(); };
    const mineMsg = m.sender.id === me?.id;
    const out: MessageAction[] = [];
    // A following parent: the one thing they can do with a message is tell the teacher.
    if (observer) {
      if (!m.hidden) out.push({ key: 'report', label: t('chat.report'), icon: 'flag', onPress: close(() => { setReporting(m); setReportReason(null); setReportNote(''); }) });
      return out;
    }
    if (room.data?.can_post && !m.hidden) out.push({ key: 'reply', label: t('chat.reply_action'), icon: 'reply', onPress: close(() => startReply(m)) });
    if (mineMsg) {
      out.push({ key: 'delete', label: t('chat.delete'), icon: 'trash', destructive: true, onPress: close(() => Alert.alert(t('chat.message_actions'), t('chat.delete_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.delete_action'), style: 'destructive', onPress: () => remove.mutate(m.id, { onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)) }) },
      ])) });
    } else if (isModerator) {
      if (!m.hidden) out.push({ key: 'remove', label: t('chat.remove_message'), icon: 'trash', destructive: true, onPress: close(() => Alert.alert(t('chat.remove_message'), t('chat.remove_confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.remove_action'), style: 'destructive', onPress: () => remove.mutate(m.id, { onError: (err) => Alert.alert('', getFriendlyErrorMessage(err)) }) },
      ])) });
      if (!m.sender.is_staff) out.push({ key: 'mute', label: t('chat.mute_writing'), icon: 'mute', onPress: close(() => setMuting({ id: m.sender.id, name: m.sender.name })) });
    } else {
      out.push({ key: 'report', label: t('chat.report'), icon: 'flag', onPress: close(() => { setReporting(m); setReportReason(null); setReportNote(''); }) });
      if (!m.sender.is_staff) out.push({ key: 'block', label: t('chat.block'), icon: 'eyeOff', destructive: true, onPress: close(() => confirmBlock(m)) });
    }
    return out;
  };

  const menuRef = useRef(onMessageMenu);
  menuRef.current = onMessageMenu;
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  const onDiscardRef = useRef(onDiscard);
  onDiscardRef.current = onDiscard;
  const reactRef = useRef(react);
  reactRef.current = react;
  const stableReact = useCallback((m: ChatMessage, e: string) => reactRef.current(m, e), []);
  const replyRef = useRef(startReply);
  replyRef.current = startReply;
  const stableReply = useCallback((m: ChatMessage) => replyRef.current(m), []);
  const jumpRef = useRef(jumpTo);
  jumpRef.current = jumpTo;
  const stableQuote = useCallback((id: number) => { void jumpRef.current({ aroundId: id }); }, []);
  const canWrite = !!room.data?.can_post;
  const stableRetry = useCallback((m: ChatMessage) => retryRef.current(m), []);
  const myId = me?.id;
  const renderRow = useCallback(({ item }: { item: RoomRow }) => {
    if (item.type === 'day') return <DateChip date={item.date} />;
    const m = item.message;
    return (
      <ChatBubble
        message={m}
        mine={m.sender.id === myId}
        showName={item.showName}
        showTail={item.showTail}
        onLongPress={onHold}
        onRetry={stableRetry}
        highlight={m.id === highlightId}
        onReply={canWrite ? stableReply : undefined}
        onQuotePress={stableQuote}
        onReact={observer ? undefined : stableReact}
        myId={myId}
      />
    );
  }, [myId, onHold, stableRetry, highlightId, canWrite, stableReply, stableQuote, stableReact, observer]);

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
        onSuccess: (msg) => {
          setOlder((prev) => prev.filter((x) => x.sender.id !== m.sender.id));
          setWin((w) => (w ? { ...w, messages: w.messages.filter((x) => x.sender.id !== m.sender.id) } : w));
          Alert.alert('', msg);
        },
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
        <TouchableOpacity onPress={() => { Keyboard.dismiss(); router.back(); }} style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Icon name="forward" size={26} color={colors.onHero} />
        </TouchableOpacity>
        {/* Tap the room's name or picture for its info page — members, moderators, the shelf. */}
        <TouchableOpacity
          onPress={infoHref ? () => router.push(infoHref as Href) : undefined}
          disabled={!infoHref}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityHint={t('chat.tap_for_info')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
        <RoomAvatar room={courseId} size={40} label={data.course.name} />
          <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.onHero }} numberOfLines={1}>
            {parentsRoom ? t('chat.parents_room_name', { course: data.course.name }) : data.course.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {/* The dot is the socket's word, not a guess: green only once the private channel is
                subscribed; amber while it tries or after it failed (the poll carries the room then). */}
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connected ? '#8FE3A2' : (socketStatus === 'off' ? colors.onHeroFaint : '#F3C969') }} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.onHeroSoft }} numberOfLines={1}>
              {typingLabel ?? [connected ? t('chat.live') : t('chat.polling'), observer ? t('chat.following_short') : null, t('chat.members_count', { count: data.course.members })].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        </TouchableOpacity>
        {isModerator ? (
          <TouchableOpacity
            onPress={() => setShowReports(true)}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={t('chat.reports_title')}
          >
            <Icon name="flag" size={21} color={colors.onHero} outline={openReports === 0} />
            {openReports > 0 ? (
              <View style={{ position: 'absolute', top: 6, end: 4, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.onPrimary }}>{openReports > 9 ? '9+' : openReports}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        {roomHref && roomsCount > 1 ? (
          <TouchableOpacity
            onPress={() => { Keyboard.dismiss(); setSwitching(true); }}
            style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={t('chat.switch_open')}
          >
            <Icon name="grid" size={20} color={colors.onHero} outline />
            {elsewhereUnread > 0 ? (
              <View style={{ position: 'absolute', top: 6, end: 2, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.onPrimary }}>{elsewhereUnread > 99 ? '99+' : elsewhereUnread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={toggleNotify} disabled={setNotify.isPending} style={{ width: 40, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={notify ? t('chat.notify_on') : t('chat.notify_off')}>
          <Icon name={notify ? 'bell' : 'bellOff'} size={21} color={notify ? colors.onHero : colors.onHeroFaint} outline />
        </TouchableOpacity>
        {isModerator ? (
          <TouchableOpacity onPress={roomMenu} style={{ width: 34, height: 44, justifyContent: 'center', alignItems: 'center' }} accessibilityRole="button" accessibilityLabel={t('chat.room_settings')}>
            <Icon name="settings" size={20} color={colors.onHero} outline />
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
      {/* No network: say plainly that what is typed is kept and goes out by itself. */}
      {!online ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceSunken, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Icon name="offline" size={15} color={colors.textSecondary} outline />
          <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary }}>
            {waiting > 0 ? t('chat.offline_waiting', { count: waiting }) : t('chat.offline_banner')}
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <View style={{ flex: 1 }}>

          <ChatWallpaper />
          <FlatList
            ref={listRef}
            inverted
            data={rows}
            keyExtractor={rowKeyExtractor}
            renderItem={renderRow}
            extraData={highlightId}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            // 16 ms: the jump button follows the finger; the keyboard drags away with the list.
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            // Older pages load as you reach the top; newer ones (under a jumped-to day) at the bottom.
            onEndReached={() => { void loadOlder(); }}
            onEndReachedThreshold={0.5}
            onStartReached={win?.hasMoreAfter ? () => { void loadNewer(); } : undefined}
            onStartReachedThreshold={0.5}
            // Keeps the reader's place when messages arrive below or pages load; at the bottom it
            // follows the newest message instead.
            maintainVisibleContentPosition={win ? { minIndexForVisible: 0 } : { minIndexForVisible: 0, autoscrollToTopThreshold: 120 }}
            onViewableItemsChanged={onViewable}
            viewabilityConfig={viewabilityConfig}
            onScrollBeginDrag={showPill}
            onMomentumScrollBegin={showPill}
            onScrollEndDrag={hidePillSoon}
            onMomentumScrollEnd={hidePillSoon}
            onScrollToIndexFailed={onScrollToIndexFailed}
            initialNumToRender={win ? 80 : 18}
            maxToRenderPerBatch={16}
            windowSize={15}
            ListHeaderComponent={
              <View>
                {loadingNewer ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} /> : null}
                {typingLabel && !win ? <TypingBubble label={typingLabel} /> : null}
              </View>
            }
            ListFooterComponent={loadingOlder
              ? <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
              : (win ? !win.hasMoreBefore : (noMoreOlder || messages.length < pageSize)) ? <RoomNotice room={data} parentsRoom={parentsRoom} /> : null}
          />

          {messages.length === 0 && !room.isFetching ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
              <View style={{ backgroundColor: chat.chipBg, borderWidth: 1, borderColor: chat.chipBorder, borderRadius: radius.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, maxWidth: 300 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.textPrimary, textAlign: 'center' }}>{t('chat.no_messages_title')}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>{t('chat.no_messages_body')}</Text>
              </View>
            </View>
          ) : null}

          {/* The floating day (Telegram): the date at the top while you scroll, and for as long
              as the room shows the past. Tap it to pick another day. */}
          {(pill.visible || win) && pill.date ? (
            <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(220)} pointerEvents="box-none"
              style={{ position: 'absolute', top: spacing.sm, left: 0, right: 0, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => setCalendarOpen(true)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t('chat.jump_to_date')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 6, ...shadows.md }}
              >
                <Icon name="calendar" size={13} color={colors.brand} outline />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>{relativeDay(pill.date) ?? formatDayDate(pill.date)}</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : null}

          {(showJump || win) && messages.length > 0 ? (
            <TouchableOpacity
              onPress={toLatest}
              accessibilityRole="button"
              accessibilityLabel={t('chat.jump_to_latest')}
              style={{
                position: 'absolute', bottom: spacing.md, end: spacing.md,
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                alignItems: 'center', justifyContent: 'center', ...shadows.md,
              }}
            >
              <Icon name="down" size={20} color={win ? colors.brand : colors.textSecondary} />
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
            onChange={onDraftChange}
            onSend={doSend}
            onAttach={attachMenu}
            onCamera={() => { void pickImage(true); }}
            onVoiceClip={onVoiceClip}
            voiceMaxSeconds={data.limits?.voice_max_seconds || 120}
            sending={false}
            onRecordingChange={setRecording}
            bottomInset={insets.bottom}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            myId={me?.id}
          />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, paddingBottom: spacing.lg + insets.bottom, backgroundColor: chat.bar, borderTopWidth: 1, borderTopColor: chat.barBorder }}>
            <Icon name={observer ? 'eye' : 'lock'} size={16} color={observer ? colors.brand : colors.textTertiary} outline={observer} />
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

      <MessageActionsOverlay
        target={held}
        mine={!!held && held.message.sender.id === me?.id}
        myId={me?.id}
        myReaction={held && me ? (held.message.reactions ?? []).find((r) => r.user_ids.includes(me.id))?.emoji ?? null : null}
        canReact={!!held && !held.message.hidden && !held.message.local && !observer}
        actions={held ? heldActions(held.message) : []}
        onReact={(e) => { if (held) react(held.message, e); setHeld(null); }}
        onClose={() => setHeld(null)}
      />
      {roomHref ? (
        <RoomSwitcher
          visible={switching}
          current={courseId}
          onClose={() => setSwitching(false)}
          onPick={(room) => { setSwitching(false); router.replace(roomHref(room) as Href); }}
        />
      ) : null}

      <ChatCalendarSheet
        visible={calendarOpen}
        courseId={courseId}
        onClose={() => setCalendarOpen(false)}
        onPick={(d) => { setCalendarOpen(false); void jumpTo({ aroundDate: d }); }}
        onLatest={() => { setCalendarOpen(false); toLatest(); }}
      />

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

/**
 * The first line of the room's history, like a messenger's «messages are encrypted» chip:
 * who can read this room. In a students' room everyone is told that the children's parents
 * follow it (founder 2026-10-12 opened the rooms to parents; nobody should learn that by
 * surprise); a parents' room says that no student is in it.
 */
function RoomNotice({ room, parentsRoom }: { room: ChatRoom; parentsRoom: boolean }) {
  const { t } = useTranslation();
  const text = parentsRoom
    ? t('chat.notice_parents_room')
    : room.role === 'observer'
      ? t('chat.notice_following')
      : room.followed_by_parents
        ? t('chat.notice_parents_follow')
        : null;
  if (!text) return null;
  return (
    <View style={{ alignSelf: 'center', maxWidth: '86%', flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.lg, backgroundColor: colors.accentWarmTint }}>
      <Icon name={parentsRoom ? 'children' : 'eye'} size={13} color={colors.accentWarm} outline={!parentsRoom} />
      <Text style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}
