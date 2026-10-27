import { create } from 'zustand';

/** One notification as the toast shows it. `id` is known for a feed row and for a push that carries `notification_id`. */
export interface InAppNotice {
  key: string;
  id: number | null;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
}

interface InAppNoticeState {
  notice: InAppNotice | null;
  /** Bumped on every new notification — the bell shakes when it changes. */
  bellPulse: number;
  /** When the last push reached the open app (the unread poll then only shakes the bell). */
  lastPushAt: number;
  /** Ids already toasted this session — a push and the poll never show the same one twice. */
  toasted: Set<number>;
  /** Opens a notification's screen; set by the role layout that knows the role and the abilities. */
  open: ((data: Record<string, unknown>, type: string) => void) | null;
  show: (n: Omit<InAppNotice, 'key'>, fromPush?: boolean) => void;
  clear: (key?: string) => void;
  pulse: () => void;
}

/**
 * The in-app notification (founder 2026-10-27: «a little toast, good looking, for in-app
 * notification, swipable to dismiss but not read; on a new notification the bell shakes»).
 * A push that reaches the open app no longer drops the system banner over the app: it shows
 * here, the bell shakes, the feed refreshes. Swiping it away leaves it unread; tapping it
 * opens what it is about and marks it read.
 */
export const useInAppNotice = create<InAppNoticeState>((set, get) => ({
  notice: null,
  bellPulse: 0,
  lastPushAt: 0,
  toasted: new Set<number>(),
  open: null,
  show: (n, fromPush = false) => {
    if (n.id !== null && get().toasted.has(n.id)) return;
    if (n.id !== null) get().toasted.add(n.id);
    set((s) => ({
      notice: { ...n, key: `${n.id ?? 'p'}-${Date.now()}` },
      bellPulse: s.bellPulse + 1,
      lastPushAt: fromPush ? Date.now() : s.lastPushAt,
    }));
  },
  clear: (key) => {
    const cur = get().notice;
    if (!cur || (key && cur.key !== key)) return;
    set({ notice: null });
  },
  pulse: () => set((s) => ({ bellPulse: s.bellPulse + 1 })),
}));

/** The id a push carries (the backend adds `notification_id`); null for an older server. */
export function noticeIdOf(data: Record<string, unknown> | null | undefined): number | null {
  const raw = data?.notification_id;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
