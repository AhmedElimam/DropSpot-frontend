import client from './client';
import i18n from '@/i18n';
import { useAuthStore } from '@/stores/authStore';

/**
 * The support channel to the platform — the Resolution Center's "مراسلة الإدارة".
 *
 * Every role writes here now (founder 2026-09-05), not just teachers: parents and
 * students used to be handed an email address and a phone number, which left no record
 * anyone could work. The reason list is served by the backend and differs by role, so the
 * app never has to guess which words a parent versus a teacher would use.
 */

export interface SupportCategory {
  key: string;
  label: string;
}

export interface AdminTicket {
  id: number;
  subject: string;
  message: string;
  category: string | null;
  category_label: string | null;
  status: 'open' | 'resolved';
  stage_label?: string | null;
  admin_note: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

/**
 * Mirrors the server's two lists (AdminTicket::CATEGORY_LABELS / FAMILY_CATEGORY_LABELS).
 * Used when /support/categories cannot be reached — a backend that predates this feature,
 * or simply a dropped request. Without it an empty list disables the picker and the
 * screen reads as broken; the keys are the same ones the server validates against, so a
 * ticket composed from the fallback still stores correctly.
 */
// Built at call time (not import time) so the backend's copy overlay can override the labels.
const FALLBACK_CATEGORIES = (): Record<'staff' | 'family', SupportCategory[]> => ({
  staff: [
    { key: 'billing', label: i18n.t('family_ui.cat_staff_billing') },
    { key: 'cards', label: i18n.t('family_ui.cat_staff_cards') },
    { key: 'app', label: i18n.t('family_ui.cat_app') },
    { key: 'account', label: i18n.t('family_ui.cat_staff_account') },
    { key: 'students', label: i18n.t('family_ui.cat_staff_students') },
    { key: 'other', label: i18n.t('family_ui.other') },
  ],
  family: [
    { key: 'billing', label: i18n.t('family_ui.cat_family_billing') },
    { key: 'cards', label: i18n.t('family_ui.cat_family_cards') },
    { key: 'teacher', label: i18n.t('family_ui.cat_family_teacher') },
    { key: 'account', label: i18n.t('family_ui.cat_family_account') },
    { key: 'app', label: i18n.t('family_ui.cat_app') },
    { key: 'other', label: i18n.t('family_ui.other') },
  ],
});

function fallbackCategories(): SupportCategory[] {
  const role = useAuthStore.getState().role;

  return FALLBACK_CATEGORIES()[role === 'teacher' || role === 'assistant' ? 'staff' : 'family'];
}

/**
 * Staff can always fall back to the legacy teacher-only path, which exists on every
 * deployed backend. Families have no legacy path — their channel is new — so for them a
 * 404 is a real "not deployed yet" and must surface as an error, not a silent no-op.
 */
function isStaff(): boolean {
  const role = useAuthStore.getState().role;

  return role === 'teacher' || role === 'assistant';
}

/** The reasons THIS user may pick. Served separately so the picker is ready first. */
export async function getSupportCategories(): Promise<SupportCategory[]> {
  try {
    const { data } = await client.get('/support/categories');
    const categories = ((data.data ?? data)?.categories ?? []) as SupportCategory[];

    return categories.length ? categories : fallbackCategories();
  } catch {
    return fallbackCategories();
  }
}

export async function getMyAdminTickets(): Promise<AdminTicket[]> {
  try {
    const { data } = await client.get('/support/tickets');
    return (data.data ?? data ?? []) as AdminTicket[];
  } catch (err: any) {
    if (err?.response?.status === 404 && isStaff()) {
      const { data } = await client.get('/teacher/admin-tickets');
      return (data.data ?? data ?? []) as AdminTicket[];
    }
    throw err;
  }
}

/** `subject` is optional — with none, the chosen reason becomes the ticket's title. */
export async function createAdminTicket(payload: {
  message: string;
  category?: string;
  subject?: string;
}): Promise<AdminTicket> {
  try {
    const { data } = await client.post('/support/tickets', payload);
    return (data.data ?? data) as AdminTicket;
  } catch (err: any) {
    if (err?.response?.status === 404 && isStaff()) {
      // The legacy path requires a subject; the reason stands in when none was typed.
      const { data } = await client.post('/teacher/admin-tickets', {
        ...payload,
        subject: payload.subject?.trim() || fallbackCategories().find((c) => c.key === payload.category)?.label || i18n.t('family_ui.admin_message_default'),
      });
      return (data.data ?? data) as AdminTicket;
    }
    throw err;
  }
}
