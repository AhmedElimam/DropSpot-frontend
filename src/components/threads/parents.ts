import type { ThreadChildRef, ThreadParticipation } from '@/api/threads';
import { arDigits } from './format';

/**
 * حكاوي for parents (founder 2026-10-15) — the pure half: whose post a card is for, what each
 * participation choice means, the moderator's audience line, the outro's viewer lines. No
 * React, so all of it is testable.
 */

const AR_LETTER = /[؀-ۿ]/;

/**
 * «لأحمد», «لأحمد ومنى», «لأحمد ومنى ويوسف», then «لأحمد ومنى و٢ كمان». The preposition joins
 * an Arabic name (a name opening with «ال» takes «لل»: «للحسن»); a Latin one keeps «لـ ».
 */
export function childLabel(children: readonly Pick<ThreadChildRef, 'name'>[] | null | undefined): string | null {
  const names = (children ?? []).map((c) => String(c.name ?? '').trim()).filter(Boolean);
  if (!names.length) return null;
  const shown = names.length > 3 ? names.slice(0, 2) : names;
  const rest = names.length - shown.length;
  const first = shown[0];
  const lead = !AR_LETTER.test(first.charAt(0)) ? `لـ ${first}` : first.startsWith('ال') ? `لل${first.slice(2)}` : `ل${first}`;
  const others = shown.slice(1).map((n) => ` و${n}`).join('');
  return `${lead}${others}${rest > 0 ? ` و${arDigits(rest)} كمان` : ''}`;
}

/** The consent sheet's three choices, in the order they sit on the control. */
export const PARTICIPATION_ORDER: readonly ThreadParticipation[] = ['on', 'read_only', 'off'];

export interface ParticipationCopy {
  label: string;
  /** One line that says exactly what the child can do. */
  line: string;
}

export const PARTICIPATION_COPY: Record<ThreadParticipation, ParticipationCopy> = {
  on: { label: 'مشاركة', line: 'بيقرا ويجاوب ويصوّت — وإنت شايف كل إجاباته.' },
  read_only: { label: 'قراءة بس', line: 'بيقرا الأسئلة وردود المدرّس، من غير ما يجاوب أو يصوّت.' },
  off: { label: 'مقفولة', line: 'حكاوي مقفولة عنده خالص: مش هيشوف أسئلة ولا هيوصله تنبيهات.' },
};

export function participationCopy(p: ThreadParticipation | null | undefined): ParticipationCopy {
  return PARTICIPATION_COPY[p && p in PARTICIPATION_COPY ? p : 'on'];
}

/** What a read-only student reads in place of the answer bar when the server sends no note. */
export const DEFAULT_READ_ONLY_NOTE = 'وليّ أمرك خلّى حكاوي قراءة بس ليك دلوقتي: تقدر تقرا الأسئلة وردود المدرّس، من غير إجابة أو تصويت.';

export function readOnlyNote(note: string | null | undefined): string {
  const s = String(note ?? '').trim();
  return s || DEFAULT_READ_ONLY_NOTE;
}

/** A comment hidden by a parent — the moderators' «أخفاها وليّ الأمر». */
export function hiddenByParent(reason: string | null | undefined): boolean {
  return reason === 'parent';
}

/** The teacher's hero: «٣٤ طالب | ٢٨ وليّ أمر بيتابعوا» (bars — a dot beside digits reads as zero). */
export function audienceLine(students: number | null | undefined, parents: number | null | undefined): string | null {
  const parts: string[] = [];
  if (typeof students === 'number') parts.push(`${arDigits(students)} طالب`);
  if (typeof parents === 'number' && parents > 0) parts.push(`${arDigits(parents)} وليّ أمر بيتابعوا`);
  return parts.length ? parts.join('  |  ') : null;
}

/** Was this report filed by a parent? Either field the server may use. */
export function reportedByParent(r: { reporter_role?: string | null; reporter?: { role?: string | null } | null }): boolean {
  return r.reporter_role === 'parent' || r.reporter?.role === 'parent';
}

// ── The outro's data block ─────────────────────────────────────────────────────

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** «١٥ أكتوبر ٢٠٢٦» — the day this viewing happened. */
export function watchedOn(date: Date): string {
  return `${arDigits(date.getDate())} ${MONTHS[date.getMonth()]} ${arDigits(date.getFullYear())}`;
}

/** «شاهده: أحمد | G5RJMZ» — the code stays Latin (it is typed back in). */
export function viewerLine(name: string | null | undefined, code: string | null | undefined): string {
  const who = String(name ?? '').trim();
  const c = String(code ?? '').trim();
  if (who && c) return `شاهده: ${who}  |  ${c}`;
  if (who) return `شاهده: ${who}`;
  return c ? `رمز المشاهدة: ${c}` : '';
}

/** «الفيزياء  |  الصف الثالث الثانوي» — what is present, nothing when neither is. */
export function subjectLine(subject: string | null | undefined, grade: string | null | undefined): string | null {
  const parts = [subject, grade].map((s) => String(s ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join('  |  ') : null;
}
