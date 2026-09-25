import client from './client';

/**
 * Cash reconciliation + expenses (spec 2026-09-25 and its two addenda). The teacher's
 * PRIVATE bookkeeping: nothing here touches invoices or what a family owes.
 *
 * Scope is decided by the SERVER, not here: an assistant's responses carry only their own
 * drawers, expenses and handovers — never the teacher's totals, never another assistant's
 * rows. The `role` field on the reconciliation payload says which shape came back.
 */

/** Weekly review (spec 2026-09-25 §1): questioned is a real middle state — held, not counted, not rejected. */
export type ReviewStatus = 'pending' | 'accepted' | 'questioned' | 'rejected';

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
  review_status: ReviewStatus;
  reject_reason: string | null;
  reject_reason_label: string | null;
  reject_note: string | null;
  reviewed_at: string | null;
  adjusts_week: string | null; // a late entry for this closed week, reviewed here
  messages_count: number;
  has_receipt: boolean;
  locked: boolean;
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
  insights_enabled?: boolean;
  insight_pushes_per_day?: number;
  review_bulk_max?: number;
}

/** A مدام روز suggestion the person confirms with a tap (v2 §5). Nothing is logged by her. */
export interface RecurringSuggestion {
  key: string;
  text: string;
  prefill: { category: string; amount: number; note: string | null };
}

export interface QuickAdd {
  category: string;
  label: string;
  amount: number;
  note: string | null;
  times: number;
}

/** An observation (v2 §6): a computed fact with the filter that lists the entries behind it. */
export interface Observation {
  key: string;
  type: string;
  text: string;
  amount: number;
  trace: { from: string; to: string; category?: string; venue?: number };
  prefill?: RecurringSuggestion['prefill'];
}

export interface CashInsights {
  role: 'teacher' | 'assistant';
  enabled: boolean;
  context: { name: string; greeting: string; season: string | null };
  observations: Observation[];
}

export async function getCashInsights(): Promise<CashInsights> {
  const { data } = await client.get('/teacher/cash/insights');
  return data.data as CashInsights;
}

export async function suggestCategory(note: string): Promise<{ category: string | null; label: string | null }> {
  const { data } = await client.get('/teacher/expenses/suggest', { params: { note } });
  return data.data;
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
  quick_add: QuickAdd[];
  recurring: RecurringSuggestion[];
}

export interface ExpenseTrace { from: string; to: string; category?: string; venue?: number | string }

export async function getExpenses(weekDay?: string, venue?: string, trace?: ExpenseTrace | null): Promise<ExpensesWeek> {
  const params: Record<string, string> = {};
  if (weekDay) params.week = weekDay;
  if (venue) params.venue = venue;
  if (trace) {
    params.from = trace.from;
    params.to = trace.to;
    if (trace.category) params.category = trace.category;
    if (trace.venue !== undefined) params.venue = String(trace.venue);
  }
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
  /** Automatic: last week's counted closing ('carried'), its expected when it was never counted ('carried_expected'), zero on the first week ('assumed_zero'); 'teacher' = overwritten by hand. */
  opening_source: 'carried' | 'carried_expected' | 'assumed_zero' | 'teacher' | null;
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
  teacher_count?: number | null;
  actual?: number | null;
  held?: number;
  rejected_expenses?: number;
  presented_expenses?: number;
  difference_before_review?: number | null;
  closed_at?: string | null;
  /** collected − expenses − held − handovers: what the week ADDED, computable even when the opening is unknown. */
  net_movement?: number;
  collected_by_kind?: KindTotals;
  /** The teacher's own hand: same equation, handovers flow IN (the handovers figure is negative). */
  is_teacher_drawer?: boolean;
  review_pending?: number;
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

/** Collected amounts by what they paid for. */
export interface KindTotals { bill: number; booklet: number; booking: number; guest_pass: number }

/** One collection event from the cash ledger — what every figure is made of. */
export interface CollectionEvent {
  id: number;
  kind: 'bill' | 'booklet' | 'booking' | 'guest_pass';
  kind_label: string;
  amount: number; // negative = a reversal
  is_reversal: boolean;
  method: 'cash' | 'digital';
  student: { id: number; name: string } | null;
  collector: { id: number; name: string; is_me: boolean } | null;
  venue: string | null;
  collected_at: string;
}

/** What should be in the registries right now, before anyone counts. */
export interface RegistryNow {
  drawers_known: number;
  drawers_known_count: number;
  drawers_unknown_count: number;
  drawers_net: number;
  teacher_hand: number;
  total_known: number;
}

export interface AssistantCashView {
  role: 'assistant';
  week: { start: string; end: string };
  settings: CashSettingsLite;
  venues: VenueRef[];
  drawers: Drawer[]; // this week, own only
  unanswered: Drawer[]; // this week or earlier, still waiting on them
  handovers: Handover[]; // own only
  collections?: CollectionEvent[]; // own only
  collected_by_kind?: KindTotals;
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
  /** The base of the equation, from the collection ledger: where this week's money sits. */
  collected_breakdown?: {
    total: number;
    cash: number;
    digital: number;
    cash_by_assistants: number;
    cash_by_teacher: number;
    unattributed: number;
    by_collector: { user_id: number; name: string; amount: number }[];
    by_kind?: KindTotals;
    events: number;
  };
  registry_now?: RegistryNow;
  collections?: CollectionEvent[];
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

export async function updateCashSettings(patch: Partial<{ expenses_enabled: boolean; expenses_per_venue: boolean; cash_tolerance: number; expense_reminder_enabled: boolean; insights_enabled: boolean; insight_pushes_per_day: number; review_bulk_max: number }>): Promise<CashSettings> {
  const { data } = await client.post('/teacher/cash/settings', patch);
  return data.data as CashSettings;
}

// ───────────────────────── weekly review ─────────────────────────

export type ReviewBlocker = 'closed' | 'not_counted' | 'opening_unknown' | 'pending_items' | 'questioned_items' | 'pending_handovers';

export interface WeeklyReview {
  reconciliation: TeacherDrawer;
  items: Expense[];
  counts: { pending: number; questioned: number; accepted: number; rejected: number };
  closed: boolean;
  // Teacher-only (absent for the drawer's own assistant):
  blocking?: ReviewBlocker[];
  can_close?: boolean;
  bulk_max?: number;
  reasons?: { key: string; label: string }[];
  flags?: { id: number; kind: 'count' | 'collection'; amount: number | null; note: string | null; created_at: string | null }[];
  corrections?: { id: number; amount: number; note: string; booked_week_start: string; created_at: string | null }[];
  pending_handovers?: number;
}

export async function getWeeklyReview(reconciliationId: number): Promise<WeeklyReview> {
  const { data } = await client.get(`/teacher/cash/reconciliation/${reconciliationId}/review`);
  return data.data as WeeklyReview;
}

/** One decision. The server returns the drawer's difference before and after it. */
export async function decideExpense(
  expenseId: number,
  payload: { action: 'accept' } | { action: 'question'; note: string } | { action: 'reject'; reason: string; note?: string },
): Promise<{ expense: Expense; before: number | null; after: number | null; reconciliation: Drawer | null }> {
  const { data } = await client.post(`/teacher/expenses/${expenseId}/review`, payload);
  return data.data;
}

/** Accepts only the pending items the teacher was shown, never above the bulk threshold. */
export async function bulkAccept(reconciliationId: number, seenIds: number[]): Promise<{ accepted: number; excluded_large: number; before: number | null; after: number | null }> {
  const { data } = await client.post(`/teacher/cash/reconciliation/${reconciliationId}/bulk-accept`, { seen_ids: seenIds });
  return data.data;
}

export async function flagReview(reconciliationId: number, payload: { kind: 'count'; amount: number; note?: string } | { kind: 'collection'; note: string; amount?: number }): Promise<WeeklyReview> {
  const { data } = await client.post(`/teacher/cash/reconciliation/${reconciliationId}/flags`, payload);
  return data.data as WeeklyReview;
}

export async function closeWeek(reconciliationId: number): Promise<WeeklyReview> {
  const { data } = await client.post(`/teacher/cash/reconciliation/${reconciliationId}/close`);
  return data.data as WeeklyReview;
}

export async function addCorrection(reconciliationId: number, amount: number, note: string): Promise<void> {
  await client.post(`/teacher/cash/reconciliation/${reconciliationId}/corrections`, { amount, note });
}

export interface ThreadMessage {
  id: number;
  body: string | null;
  author: string;
  is_me: boolean;
  is_teacher: boolean;
  attachment_url: string | null;
  created_at: string | null;
}

export interface ExpenseThread {
  expense: Expense;
  messages: ThreadMessage[];
  can_reply: boolean;
}

export async function getExpenseThread(expenseId: number): Promise<ExpenseThread> {
  const { data } = await client.get(`/teacher/expenses/${expenseId}/thread`);
  return data.data as ExpenseThread;
}

export async function replyToThread(expenseId: number, body: string, imageUri?: string | null): Promise<ExpenseThread> {
  if (!imageUri) {
    const { data } = await client.post(`/teacher/expenses/${expenseId}/thread`, { body });
    return data.data as ExpenseThread;
  }
  const form = new FormData();
  const name = imageUri.split('/').pop() || 'receipt.jpg';
  const ext = (name.split('.').pop() || 'jpg').toLowerCase();
  const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  if (body) form.append('body', body);
  form.append('attachment', { uri: imageUri, name, type: MIME[ext] ?? 'image/jpeg' } as any);
  const { data } = await client.post(`/teacher/expenses/${expenseId}/thread`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.data as ExpenseThread;
}

// ───────────────────────── past periods + the Markdown report ─────────────────────────

export interface CashMonthWeek {
  week_start: string;
  week_end: string;
  collected: number;
  expenses: number;
  drawers: number;
  counted: number;
  deficit: number;
  surplus: number;
  closed: boolean;
}

export interface CashMonth {
  role: 'teacher' | 'assistant';
  period: { kind: 'month'; start: string; end: string; label: string };
  totals: {
    collected: number;
    by_kind: KindTotals;
    expenses: number;
    handovers: number;
    deficit: number;
    surplus: number;
    expenses_by_category: { key: string; label: string; amount: number }[];
    // teacher only
    cash?: number;
    digital?: number;
    cash_by_assistants?: number;
    cash_by_teacher?: number;
    uncounted?: number;
  };
  weeks: CashMonthWeek[];
}

/** month = 'YYYY-MM' */
export async function getCashMonth(month: string): Promise<CashMonth> {
  const { data } = await client.get('/teacher/cash/month', { params: { month } });
  return data.data as CashMonth;
}

/** The period as Markdown (مدام روز «.md»), in the viewer's scope. */
export async function getCashReport(p: { period: 'week'; week: string } | { period: 'month'; month: string }): Promise<{ filename: string; markdown: string }> {
  const { data } = await client.get('/teacher/cash/report', { params: p });
  return data.data as { filename: string; markdown: string };
}
