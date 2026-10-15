/**
 * حكاوي's pure helpers (founder 2026-10-15: «call it حكاوي», «threads on UI level needs a lot
 * of love»): the state a post is in, the filter chips' counts, the clock in words and its
 * rounding (a far-off clock must not re-render every second), and the avatar's initials.
 */
import { ago, arDigits, countOf, filterCounts, fractionLeft, humanLeft, initials, matchesFilter, quantize, ringParts, stateOf, tickFor, TIMER_PRESETS } from '../format';

const q = (over: Partial<{ kind: 'question' | 'note' | 'answer'; answered_at: string | null; open: boolean; closed_reason: 'answered' | 'locked' | 'timer' | null }>) => ({
  kind: 'question' as const, answered_at: null, open: true, closed_reason: null, ...over,
});

describe('stateOf / filters', () => {
  it('reads the round', () => {
    expect(stateOf(q({}))).toBe('open');
    expect(stateOf(q({ open: false, closed_reason: 'timer' }))).toBe('timer');
    expect(stateOf(q({ open: false, closed_reason: 'locked' }))).toBe('locked');
    expect(stateOf(q({ open: false, answered_at: '2026-10-15T10:00:00Z', closed_reason: 'answered' }))).toBe('answered');
    expect(stateOf(q({ kind: 'note' }))).toBe('note');
  });

  it('«مستنية رد» holds both a timed-out and a locked round', () => {
    expect(matchesFilter('timer', 'waiting')).toBe(true);
    expect(matchesFilter('locked', 'waiting')).toBe(true);
    expect(matchesFilter('answered', 'waiting')).toBe(false);
    expect(matchesFilter('note', 'all')).toBe(true);
  });

  it('counts every chip', () => {
    const counts = filterCounts([
      q({}), q({}), q({ open: false, closed_reason: 'timer' }), q({ open: false, closed_reason: 'locked' }),
      q({ open: false, answered_at: 'x' }), q({ kind: 'note' }),
    ]);
    expect(counts).toEqual({ all: 6, open: 2, waiting: 2, answered: 1, notes: 1 });
  });
});

describe('the clock', () => {
  it('ticks every second only in the last hour', () => {
    expect(tickFor(59 * 60)).toBe(1);
    expect(tickFor(5 * 3600)).toBe(30);
    expect(tickFor(3 * 86400)).toBe(300);
  });

  it('rounds up, never claiming less time than there is', () => {
    expect(quantize(125)).toBe(125);
    expect(quantize(3 * 3600 + 1)).toBe(3 * 3600 + 30);
    expect(quantize(2 * 86400 + 10)).toBe(2 * 86400 + 300);
  });

  it('speaks Egyptian counting', () => {
    expect(countOf(1, ['ساعة', 'ساعتين', 'ساعات', 'ساعة'])).toBe('ساعة');
    expect(countOf(2, ['ساعة', 'ساعتين', 'ساعات', 'ساعة'])).toBe('ساعتين');
    expect(countOf(3, ['ساعة', 'ساعتين', 'ساعات', 'ساعة'])).toBe('٣ ساعات');
    expect(countOf(11, ['ساعة', 'ساعتين', 'ساعات', 'ساعة'])).toBe('١١ ساعة');
  });

  it('reads the time left in words, then mm:ss at the end', () => {
    expect(humanLeft(3 * 86400)).toBe('٣ أيام');
    expect(humanLeft(86400 + 5 * 3600)).toBe('يوم و٥ ساعات');
    expect(humanLeft(3 * 3600 + 120)).toBe('٣ ساعات');
    expect(humanLeft(2 * 3600 + 10 * 60)).toBe('ساعتين و١٠ دقايق');
    expect(humanLeft(45 * 60)).toBe('٤٥ دقيقة');
    expect(humanLeft(9 * 60 + 41)).toBe('٠٩:٤١');
    expect(humanLeft(0)).toBe('٠٠:٠٠');
  });

  it('gives the ring a figure and a unit', () => {
    expect(ringParts(3 * 3600)).toEqual({ value: '٣', unit: 'ساعات' });
    expect(ringParts(86400)).toEqual({ value: '١', unit: 'يوم' });
    expect(ringParts(20 * 60)).toEqual({ value: '٢٠', unit: 'دقيقة' });
    expect(ringParts(65).value).toBe('٠١:٠٥');
  });

  it('drains from 1 to 0 over the round', () => {
    const start = Date.parse('2026-10-15T10:00:00Z');
    const created = new Date(start).toISOString();
    const ends = new Date(start + 3600_000).toISOString();
    expect(fractionLeft(created, ends, start)).toBe(1);
    expect(fractionLeft(created, ends, start + 1800_000)).toBeCloseTo(0.5);
    expect(fractionLeft(created, ends, start + 7200_000)).toBe(0);
  });
});

describe('the rest', () => {
  it('writes Arabic-Indic digits', () => {
    expect(arDigits(2026)).toBe('٢٠٢٦');
    expect(arDigits('12:05')).toBe('١٢:٠٥');
  });

  it('says how long ago', () => {
    const now = Date.parse('2026-10-15T12:00:00Z');
    expect(ago(new Date(now - 20_000).toISOString(), now)).toBe('دلوقتي');
    expect(ago(new Date(now - 5 * 60_000).toISOString(), now)).toBe('من ٥ د');
    expect(ago(new Date(now - 3 * 3600_000).toISOString(), now)).toBe('من ٣ س');
    expect(ago(new Date(now - 30 * 3600_000).toISOString(), now)).toBe('امبارح');
    expect(ago(new Date(now - 4 * 86400_000).toISOString(), now)).toBe('من ٤ أيام');
  });

  it('draws initials without titles and without joining Arabic letters', () => {
    expect(initials('مستر أحمد علي')).toBe('أ‌ع');
    expect(initials('أ/ منى')).toBe('م');
    expect(initials('Ahmed Elimam')).toBe('AE');
    expect(initials('')).toBe('؟');
  });

  it('offers the presets the founder listed, within the server window', () => {
    expect(TIMER_PRESETS.map((p) => p.minutes)).toEqual([15, 60, 360, 1440, 4320, 10080, 0]);
    expect(TIMER_PRESETS.every((p) => p.minutes === 0 || (p.minutes >= 5 && p.minutes <= 7 * 24 * 60))).toBe(true);
  });
});
