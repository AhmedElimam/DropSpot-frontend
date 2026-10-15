import { create } from 'zustand';

/**
 * «Show in chat» and «jump to a date» from the room's info page: the info page records where
 * to go and steps back; the room, already under it in the stack, picks the request up and
 * opens there. A nonce makes the same request twice still count twice.
 */
export interface ChatJump {
  courseId: number;
  messageId?: number;
  /** YYYY-MM-DD, Cairo day. */
  date?: string;
  /** Leave any history window and return to the newest message. */
  latest?: boolean;
  nonce: number;
}

interface JumpState {
  request: ChatJump | null;
  requestJump: (j: Omit<ChatJump, 'nonce'>) => void;
  clear: (nonce: number) => void;
}

let n = 0;
export const useChatJump = create<JumpState>((set, get) => ({
  request: null,
  requestJump: (j) => set({ request: { ...j, nonce: ++n } }),
  clear: (nonce) => { if (get().request?.nonce === nonce) set({ request: null }); },
}));
