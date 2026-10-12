import { existsSync } from 'fs';
import { join } from 'path';
import ar from '../../../i18n/ar.json';

/**
 * مدام روز's marks in the app (founder 2026-10-07): her stamps and portrait ship with the
 * app, and every line that goes with a stamp keeps her rule — facts about the book, never
 * praise or a verdict on a person (feedback_madam_rose_no_approval).
 */
const ASSETS = join(__dirname, '../../../../assets/images/rose');
// The server's MadamRose::PATRONISING list, as far as plain substrings carry it.
const PATRONISING = ['راضي', 'مبسوط', 'فخور', 'بتحب', 'بيعجب', 'شاطر', 'برافو', 'يوم حلو', 'أحسنت', 'تسلم إيد', 'يا بطل', 'يا قمر', 'حبيب'];

describe('مدام روز marks', () => {
  it('ships both inks and her portrait', () => {
    for (const f of ['rose-stamp-navy.webp', 'rose-stamp-red.webp', 'madam-rose.webp']) {
      expect(existsSync(join(ASSETS, f))).toBe(true);
    }
  });

  it('her desk has the four segments and the sheet', () => {
    const cash = (ar as any).cash;
    expect(cash.seg_week).toBe('الخزنة');
    expect(cash.seg_complaints).toBe('الاعتراضات');
    expect(cash.seg_notes).toBeTruthy();
    expect((ar as any).expenses.title).toBeTruthy();
    expect(cash.sheet_title).toBe('ورقة النهارده');
    expect(cash.sheet_more).toContain('{{count}}');
  });

  it('every stamp line names her through {{rose}} and states a fact, never approval', () => {
    const lines: string[] = [
      (ar as any).cash.stamp_handover,
      (ar as any).cash.stamp_closed,
      (ar as any).cash.in_book,
      (ar as any).cash.complaints_line,
      (ar as any).complaints.stamp_decided,
    ];
    for (const line of lines) {
      expect(line).toContain('{{rose}}');
      for (const w of PATRONISING) expect(line).not.toContain(w);
    }
    // A decision is recorded whichever way it went — the line must not take a side.
    expect((ar as any).complaints.stamp_decided).not.toMatch(/مقبول|مرفوض/);
    // She records complaints; the decision is the teacher's.
    expect((ar as any).cash.complaints_line).toContain('القرار ليك');
  });
});
