/**
 * An assistant's rank, read from what the teacher trusts them with (founder 2026-10-09:
 * «make assistant ranks according to the permissions»). Not a count: one ability that runs
 * the schedule weighs more than three at the door.
 *
 *   ١ مساعد الباب     the door: scanning, manual attendance, incidents, guest passes, a bill
 *                     corrected at the door (edit_bill_amount is on for every new assistant)
 *   ٢ مساعد أول       the desk: students, tickets, payment proofs
 *   ٣ مساعد تنفيذي    running the work: sessions, cancelling, courses, student PDF reports
 *   ٤ اليد اليمنى     everything the teacher can hand over
 *
 * Mirrors TeacherAssistant::ABILITIES on the server; an ability this file does not know
 * yet counts as the door, so a new permission never lifts a rank by accident.
 */
export const DESK = ['reply_tickets', 'manage_students', 'review_payment_proofs'] as const;
export const MANAGEMENT = ['manage_sessions', 'cancel_sessions', 'manage_courses', 'export_reports'] as const;

export interface AssistantRank {
  key: 'none' | 'door' | 'desk' | 'executive' | 'right_hand';
  level: 0 | 1 | 2 | 3 | 4;
  title: string;
  /** The rank's metal — bronze, silver, gold, and ink-with-gold for the right hand. */
  color: string;
  tint: string;
}

const RANKS: Record<AssistantRank['key'], Omit<AssistantRank, 'key'>> = {
  none: { level: 0, title: 'بدون صلاحيات', color: '#8A8F9E', tint: 'rgba(138,143,158,0.14)' },
  door: { level: 1, title: 'مساعد الباب', color: '#A86B32', tint: 'rgba(168,107,50,0.14)' },
  desk: { level: 2, title: 'مساعد أول', color: '#6F7B91', tint: 'rgba(111,123,145,0.16)' },
  executive: { level: 3, title: 'مساعد تنفيذي', color: '#A8841C', tint: 'rgba(201,162,39,0.18)' },
  right_hand: { level: 4, title: 'اليد اليمنى', color: '#34419B', tint: 'rgba(52,65,155,0.14)' },
};

export function assistantRank(abilities: readonly string[], catalog?: readonly string[]): AssistantRank {
  const has = new Set(abilities);
  let key: AssistantRank['key'] = 'none';
  if (has.size > 0) key = 'door';
  if (DESK.some((a) => has.has(a))) key = 'desk';
  if (MANAGEMENT.some((a) => has.has(a))) key = 'executive';
  if (catalog && catalog.length > 0 && catalog.every((a) => has.has(a))) key = 'right_hand';

  return { key, ...RANKS[key] };
}
