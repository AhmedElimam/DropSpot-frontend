import { homeworkNote } from '../homework';

const t = (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
const summary = (good: number, acceptable: number, weak: number, missing: number, rate: number | null) => ({ good, acceptable, weak, missing, graded: good + acceptable + weak + missing, rate });

describe('homeworkNote', () => {
  it('never given: nothing on the desk', () => {
    expect(homeworkNote(null, 0, t)).toBeNull();
    expect(homeworkNote(summary(0, 0, 0, 0, null), 0, t)).toBeNull();
  });

  it('given but not graded yet: an info line without counts', () => {
    const n = homeworkNote(summary(0, 0, 0, 0, null), 2, t);
    expect(n).toEqual({ tone: 'info', title: 'homework.nazer_title_none', sub: undefined });
  });

  it('tones by the rate and names the four grades', () => {
    expect(homeworkNote(summary(8, 0, 0, 1, 89), 9, t)?.tone).toBe('success');
    expect(homeworkNote(summary(4, 2, 1, 1, 63), 8, t)?.tone).toBe('info');
    expect(homeworkNote(summary(1, 0, 2, 2, 20), 5, t)?.tone).toBe('warning');
    const sub = homeworkNote(summary(4, 2, 1, 1, 63), 8, t)!.sub!;
    expect(sub.split(' · ').map((x) => x.split(' ')[0])).toEqual(['homework.rating.good', 'homework.rating.acceptable', 'homework.rating.weak', 'homework.rating.missing']);
  });
});
