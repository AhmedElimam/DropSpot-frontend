import { homeworkNote } from '../homework';

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
const summary = (done: number, partial: number, missing: number, rate: number | null) => ({ done, partial, missing, graded: done + partial + missing, rate });

describe('homeworkNote', () => {
  it('never given: nothing on the desk', () => {
    expect(homeworkNote(null, 0, t)).toBeNull();
    expect(homeworkNote(summary(0, 0, 0, null), 0, t)).toBeNull();
  });

  it('given but not graded yet: an info line without counts', () => {
    const n = homeworkNote(summary(0, 0, 0, null), 2, t);
    expect(n).toEqual({ tone: 'info', title: 'homework.nazer_title_none', sub: undefined });
  });

  it('tones by the rate', () => {
    expect(homeworkNote(summary(8, 0, 1, 89), 9, t)?.tone).toBe('success');
    expect(homeworkNote(summary(5, 1, 2, 69), 8, t)?.tone).toBe('info');
    expect(homeworkNote(summary(1, 0, 4, 20), 5, t)?.tone).toBe('warning');
    expect(homeworkNote(summary(5, 1, 2, 69), 8, t)?.sub).toContain('homework.rating.partial');
  });
});
