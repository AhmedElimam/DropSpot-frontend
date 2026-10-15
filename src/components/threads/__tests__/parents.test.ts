/**
 * حكاوي for parents (founder 2026-10-15): the card's child label, the consent choices' copy,
 * the read-only note, the moderator's audience line, the report's parent flag, and the
 * outro's data lines (bars, never «·» beside digits).
 */
import {
  DEFAULT_READ_ONLY_NOTE, PARTICIPATION_COPY, PARTICIPATION_ORDER, audienceLine, childLabel, hiddenByParent,
  participationCopy, readOnlyNote, reportedByParent, subjectLine, viewerLine, watchedOn,
} from '../parents';
import { notificationRouteFor } from '@/utils/notification-routing';

describe('childLabel', () => {
  it('joins the preposition to one or more Arabic names', () => {
    expect(childLabel([{ name: 'أحمد' }])).toBe('لأحمد');
    expect(childLabel([{ name: 'أحمد' }, { name: 'منى' }])).toBe('لأحمد ومنى');
    expect(childLabel([{ name: 'أحمد' }, { name: 'منى' }, { name: 'يوسف' }])).toBe('لأحمد ومنى ويوسف');
  });
  it('folds a long list into «و٢ كمان»', () => {
    expect(childLabel([{ name: 'أحمد' }, { name: 'منى' }, { name: 'يوسف' }, { name: 'سارة' }])).toBe('لأحمد ومنى و٢ كمان');
  });
  it('«ال» names take «لل»; Latin names keep «لـ »; nothing → null', () => {
    expect(childLabel([{ name: 'الحسن' }])).toBe('للحسن');
    expect(childLabel([{ name: 'Adam' }])).toBe('لـ Adam');
    expect(childLabel([])).toBeNull();
    expect(childLabel(null)).toBeNull();
    expect(childLabel([{ name: '  ' }])).toBeNull();
  });
});

describe('participation copy', () => {
  it('has the three choices in the control order, each with a label and one line', () => {
    expect(PARTICIPATION_ORDER).toEqual(['on', 'read_only', 'off']);
    expect(PARTICIPATION_COPY.on.label).toBe('مشاركة');
    expect(PARTICIPATION_COPY.read_only.label).toBe('قراءة بس');
    expect(PARTICIPATION_COPY.off.label).toBe('مقفولة');
    for (const p of PARTICIPATION_ORDER) expect(PARTICIPATION_COPY[p].line.length).toBeGreaterThan(10);
  });
  it('falls back to «on» for an unknown value', () => {
    expect(participationCopy(null)).toBe(PARTICIPATION_COPY.on);
    expect(participationCopy('weird' as never)).toBe(PARTICIPATION_COPY.on);
  });
  it('repeats the server note, or a default sentence', () => {
    expect(readOnlyNote('بابا قال قراءة بس')).toBe('بابا قال قراءة بس');
    expect(readOnlyNote(null)).toBe(DEFAULT_READ_ONLY_NOTE);
    expect(readOnlyNote('  ')).toBe(DEFAULT_READ_ONLY_NOTE);
  });
});

describe('moderator lines', () => {
  it('reads the audience with bars, parents only when there are some', () => {
    expect(audienceLine(34, 28)).toBe('٣٤ طالب  |  ٢٨ وليّ أمر بيتابعوا');
    expect(audienceLine(34, 0)).toBe('٣٤ طالب');
    expect(audienceLine(34, null)).toBe('٣٤ طالب');
    expect(audienceLine(null, undefined)).toBeNull();
    expect(audienceLine(34, 28)).not.toContain('·');
  });
  it('knows a parent hide and a parent report', () => {
    expect(hiddenByParent('parent')).toBe(true);
    expect(hiddenByParent('spam')).toBe(false);
    expect(reportedByParent({ reporter_role: 'parent' })).toBe(true);
    expect(reportedByParent({ reporter: { role: 'parent' } })).toBe(true);
    expect(reportedByParent({ reporter_role: 'student' })).toBe(false);
    expect(reportedByParent({})).toBe(false);
  });
});

describe('the outro data', () => {
  it('names the viewer and the play code with a bar', () => {
    expect(viewerLine('أحمد', 'G5RJMZ')).toBe('شاهده: أحمد  |  G5RJMZ');
    expect(viewerLine('أحمد', null)).toBe('شاهده: أحمد');
    expect(viewerLine(null, 'G5RJMZ')).toBe('رمز المشاهدة: G5RJMZ');
    expect(viewerLine('أحمد', 'G5RJMZ')).not.toContain('·');
  });
  it('writes the day in Egyptian months and Arabic digits', () => {
    expect(watchedOn(new Date(2026, 9, 15))).toBe('١٥ أكتوبر ٢٠٢٦');
    expect(watchedOn(new Date(2027, 0, 3))).toBe('٣ يناير ٢٠٢٧');
  });
  it('joins subject and grade, or leaves the line out', () => {
    expect(subjectLine('فيزياء', 'الصف الثالث')).toBe('فيزياء  |  الصف الثالث');
    expect(subjectLine(null, 'الصف الثالث')).toBe('الصف الثالث');
    expect(subjectLine(null, '')).toBeNull();
  });
});

describe('حكاوي pushes, per role', () => {
  it('opens the thread for a parent, or the community tab’s حكاوي', () => {
    expect(notificationRouteFor({ role: 'parent', type: 'thread_child_picked', data: { thread_id: 41 } })).toBe('/(parent)/chat/thread/41');
    expect(notificationRouteFor({ role: 'parent', type: 'thread_child_hidden', data: { thread_id: '42' } })).toBe('/(parent)/chat/thread/42');
    expect(notificationRouteFor({ role: 'parent', type: 'thread_child_picked', data: {} })).toBe('/(parent)/(tabs)/community?segment=threads');
  });
  it('sends a student whose parent changed their part to the حكاوي side', () => {
    expect(notificationRouteFor({ role: 'student', type: 'thread_participation', data: { participation: 'read_only' } })).toBe('/(student)/(tabs)/chat?segment=threads');
    expect(notificationRouteFor({ role: 'student', type: 'thread_comment_hidden', data: { thread_id: 7 } })).toBe('/(student)/chat/thread/7');
  });
});
