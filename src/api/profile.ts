import client from './client';

/**
 * Tier A — a parent edits their OWN display name directly (self-owned account). A student's
 * name is a reviewed request instead (see submitMyNameCorrection in api/students).
 */
export async function updateMyName(payload: { first_name: string; last_name?: string }): Promise<{ name: string }> {
  const { data } = await client.put('/me/name', payload);
  return (data.data ?? {}) as { name: string };
}

/**
 * "My name is already correct" — the other half of the first-login ask. A parent whose
 * derived name happens to be right closes the prompt without retyping it; forcing a
 * retype is how a prompt teaches people to dismiss it.
 */
export async function confirmMyName(): Promise<{ name: string }> {
  const { data } = await client.post('/me/name/confirm');
  return (data.data ?? {}) as { name: string };
}

export type CardState = 'none' | 'preparing' | 'in_hand';

export interface CardStatus {
  /** Always null — there is no in-app QR. Kept so an older build reading it gets nothing. */
  card_token: string | null;
  has_physical_card: boolean;
  /** none = no card and none coming · preparing = being printed · in_hand. */
  card_state: CardState;
  student_code: string | null;
}

/**
 * Where the student's card stands, live. Asked for on the profile screen rather than
 * read from the cached login payload, which can be weeks old on a device that has not
 * signed in since — and a card's state changes without the student doing anything.
 */
export async function getMyCardStatus(): Promise<CardStatus> {
  const { data } = await client.get('/me/card');
  return (data.data ?? {}) as CardStatus;
}
