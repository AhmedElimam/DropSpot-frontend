import client from './client';

/**
 * Cash reconciliation + expenses (spec 2026-09-25). The teacher's PRIVATE bookkeeping:
 * nothing here touches invoices or what a family owes.
 *
 * Scope is decided by the SERVER, not here: an assistant's responses carry only what they
 * personally collected and logged — never the teacher's totals. The `role` field on the
 * reconciliation payload says which shape came back.
 */

export type ExpenseCategory = 'coffee' | 'breakfast' | 'bills' | 'transport' | 'supplies' | 'printing' | 'rent' | 'other';

export interface Expense {
  id: number;
  amount: number;
  category: ExpenseCategory | string;
  category_label: string;
  note: string | null;
  expense_date: string; // YYYY-MM-DD — the day it belongs to
  is_late: boolean; // logged after that week (Fri→Thu) had closed
  is_teacher_expense: boolean | null;
  logged_at: string | null; // ISO — when it was actually entered
  logged_by: { id: number; name: string; is_me: boolean };
}

export interface ExpensesWeek {
  week: { start: string; end: string };
  items: Expense[];
  total: number;
  categories: { key: string; label: string }[];
  own_only: boolean; // true for an assistant: only their own entries
}

export async function getExpenses(weekDay?: string): Promise<ExpensesWeek> {
  const { data } = await client.get('/teacher/expenses', { params: weekDay ? { week: weekDay } : undefined });
  return data.data as ExpensesWeek;
}

export async function addExpense(payload: { amount: number; category: string; note?: string; expense_date?: string }): Promise<Expense> {
  const { data } = await client.post('/teacher/expenses', payload);
  return data.data as Expense;
}

export async function deleteExpense(id: number): Promise<void> {
  await client.delete(`/teacher/expenses/${id}`);
}

export type ReconciliationStatus = 'pending' | 'confirmed' | 'discrepancy' | 'not_reconciled';

/** One assistant's week as THEY see it (their own figures only). */
export interface MyReconciliation {
  id: number;
  week_start: string;
  week_end: string;
  status: ReconciliationStatus;
  collected: number;
  expenses: number;
  expected_in_registry: number;
  registry: number | null;
  gap: number | null;
  reason: string | null;
  responded_at: string | null;
}

export interface AssistantCashView {
  role: 'assistant';
  week: { start: string; end: string };
  collected: number;
  expenses: number;
  expected_in_registry: number;
  reconciliation: MyReconciliation | null;
  unanswered: MyReconciliation[]; // this week or earlier, still waiting on them
}

export interface AssistantLine {
  user_id: number;
  name: string;
  reconciliation_id: number;
  status: ReconciliationStatus;
  collected: number;
  expenses: number;
  registry: number | null;
  gap: number | null;
  reason: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  running_gap: number;
}

export interface OpenGap {
  reconciliation_id: number;
  user_id: number;
  name: string;
  week_start: string;
  week_end: string;
  gap: number;
  reason: string | null;
}

export interface TeacherCashView {
  role: 'teacher';
  week: { start: string; end: string };
  collected: number;
  expenses: number;
  expenses_by_assistants: number;
  expenses_by_teacher: number;
  assistants: AssistantLine[];
  open_gaps: OpenGap[];
  running_gaps: { user_id: number; name: string; gap: number }[];
}

export type CashView = AssistantCashView | TeacherCashView;

export async function getCashReconciliation(weekDay?: string): Promise<CashView> {
  const { data } = await client.get('/teacher/cash/reconciliation', { params: weekDay ? { week: weekDay } : undefined });
  return data.data as CashView;
}

export async function respondReconciliation(
  id: number,
  payload: { full: true } | { full: false; registry: number; reason?: string },
): Promise<{ id: number; status: ReconciliationStatus; collected: number; expenses: number; registry: number; gap: number }> {
  const { data } = await client.post(`/teacher/cash/reconciliation/${id}/respond`, payload);
  return data.data;
}

export async function resolveReconciliation(id: number): Promise<void> {
  await client.post(`/teacher/cash/reconciliation/${id}/resolve`);
}
