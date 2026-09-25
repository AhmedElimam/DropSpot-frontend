import client from './client';

/**
 * Cash reconciliation + expenses (spec 2026-09-25 and its two addenda). The teacher's
 * PRIVATE bookkeeping: nothing here touches invoices or what a family owes.
 *
 * Scope is decided by the SERVER, not here: an assistant's responses carry only their own
 * drawers, expenses and handovers — never the teacher's totals, never another assistant's
 * rows. The `role` field on the reconciliation payload says which shape came back.
 */

export type ExpenseCategory = 'coffee' | 'breakfast' | 'bills' | 'transport' | 'supplies' | 'printing' | 'rent' | 'other';
export type VenueRef = { id: number; name: string | null };
export type VenueKind = 'venue' | 'general' | 'unassigned';

export interface Expense {
  id: number;
  amount: number;
  category: ExpenseCategory | string;
  category_label: string;
  note: string | null;
  expense_date: string; // YYYY-MM-DD — the day it belongs to
  is_late: boolean; // logged after that week (Fri→Thu) had closed
  is_teacher_expense: boolean | null;
  venue: VenueRef | null;
  venue_kind: VenueKind; // unassigned = logged before per-venue was on; never guessed
  logged_at: string | null; // ISO — when it was actually entered
  logged_by: { id: number; name: string; is_me: boolean };
}

export interface CashSettingsLite {
  expenses_enabled: boolean;
  per_venue: boolean;
}

export interface CashSettings extends CashSettingsLite {
  tolerance: number;
  expense_reminder_enabled?: boolean;
}

export interface ExpensesWeek {
  week: { start: string; end: string };
  settings: CashSettingsLite;
  items: Expense[];
  total: number;
  categories: { key: string; label: string }[];
  own_only: boolean; // true for an assistant: only their own entries
  venues: VenueRef[]; // only when per_venue
  default_venue_id: number | null; // today's most recent session venue — a default, always editable
  unassigned_count: number;
}

export async function getExpenses(weekDay?: string, venue?: string): Promise<ExpensesWeek> {
  const params: Record<string, string> = {};
  if (weekDay) params.week = weekDay;
  if (venue) params.venue = venue;
  const { data } = await client.get('/teacher/expenses', { params });
  return data.data as ExpensesWeek;
}

export async function addExpense(payload: {
  amount: number; category: string; note?: string; expense_date?: string;
  teacher_location_id?: number | null; is_general?: boolean;
}): Promise<Expense> {
  const { data } = await client.post('/teacher/expenses', payload);
  return data.data as Expense;
}

export async function assignExpenseVenue(id: number, payload: { teacher_location_id: number | null; is_general: boolean }): Promise<Expense> {
  const { data } = await client.patch(`/teacher/expenses/${id}/venue`, payload);
  return data.data as Expense;
}

export async function deleteExpense(id: number): Promise<void> {
  await client.delete(`/teacher/expenses/${id}`);
}

export type ReconciliationStatus = 'pending' | 'confirmed' | 'discrepancy' | 'awaiting_opening' | 'not_reconciled';
export type ReconciliationResult = 'deficit' | 'balanced' | 'surplus' | 'unknown';

/** One drawer's week: expected = opening + collected − expenses − handovers; difference = registry − expected. */
export interface Drawer {
  id: number;
  week_start: string;
  week_end: string;
  venue: VenueRef | null;
  status: ReconciliationStatus;
  result: ReconciliationResult | null;
  opening_balance: number | null; // null = unknown — never guessed
  opening_source: 'carried' | 'teacher' | null;
  opening_reason: 'first_week' | 'previous_unreconciled' | null;
  collected: number;
  expenses: number;
  handovers: number; // confirmed transfers to the teacher
  expected: number | null;
  registry: number | null;
  difference: number | null; // exact, even when "balanced"
  tolerance: number;
  reason: string | null;
  responded_at: string | null;
  resolved_at: string | null;
}

export interface TeacherDrawer extends Drawer {
  user_id: number;
  name: string;
}

export interface Handover {
  id: number;
  amount: number;
  note: string | null;
  handover_date: string;
  venue: VenueRef | null;
  status: 'pending' | 'confirmed' | 'rejected';
  recorded_by_teacher: boolean;
  reviewed_at: string | null;
  assistant_user_id?: number;
  assistant_name?: string;
}

export interface AssistantCashView {
  role: 'assistant';
  week: { start: string; end: string };
  settings: CashSettingsLite;
  venues: VenueRef[];
  drawers: Drawer[]; // this week, own only
  unanswered: Drawer[]; // this week or earlier, still waiting on them
  handovers: Handover[]; // own only
}

export interface RunningTotal {
  user_id: number;
  name: string;
  deficit_total: number;
  deficit_weeks: number;
  surplus_total: number;
  surplus_weeks: number;
}

export interface TeacherCashView {
  role: 'teacher';
  week: { start: string; end: string };
  settings: CashSettings;
  venues: VenueRef[];
  assistants: { user_id: number; name: string }[];
  collected: number;
  expenses: number;
  expenses_by_assistants: number;
  expenses_by_teacher: number;
  unassigned_expenses: number;
  handovers_confirmed: number;
  drawers: TeacherDrawer[];
  pending_handovers: Handover[];
  week_handovers: Handover[];
  open_gaps: TeacherDrawer[];
  running_totals: RunningTotal[];
}

export type CashView = AssistantCashView | TeacherCashView;

export async function getCashReconciliation(weekDay?: string): Promise<CashView> {
  const { data } = await client.get('/teacher/cash/reconciliation', { params: weekDay ? { week: weekDay } : undefined });
  return data.data as CashView;
}

export async function respondReconciliation(
  id: number,
  payload: { full: true } | { full: false; registry: number; reason?: string },
): Promise<Drawer> {
  const { data } = await client.post(`/teacher/cash/reconciliation/${id}/respond`, payload);
  return data.data as Drawer;
}

export async function setOpeningBalance(id: number, amount: number): Promise<Drawer> {
  const { data } = await client.post(`/teacher/cash/reconciliation/${id}/opening-balance`, { amount });
  return data.data as Drawer;
}

export async function resolveReconciliation(id: number): Promise<void> {
  await client.post(`/teacher/cash/reconciliation/${id}/resolve`);
}

export async function recordHandover(payload: {
  amount: number; note?: string; handover_date?: string; assistant_user_id?: number; teacher_location_id?: number | null;
}): Promise<{ id: number; status: Handover['status']; amount: number }> {
  const { data } = await client.post('/teacher/cash/handovers', payload);
  return data.data;
}

export async function reviewHandover(id: number, decision: 'confirm' | 'reject'): Promise<void> {
  await client.post(`/teacher/cash/handovers/${id}/${decision}`);
}

export async function updateCashSettings(patch: Partial<{ expenses_enabled: boolean; expenses_per_venue: boolean; cash_tolerance: number; expense_reminder_enabled: boolean }>): Promise<CashSettings> {
  const { data } = await client.post('/teacher/cash/settings', patch);
  return data.data as CashSettings;
}
