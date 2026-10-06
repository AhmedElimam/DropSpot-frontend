import ar from '../../i18n/ar.json';
import { nextShowable } from '../store';
import { holeFor, placeCard, onScreen } from '../geometry';
import { TEACHER_TOUR, PARENT_TOUR, STUDENT_TOUR, tourForRole } from '../tours';

const has = (key: string) => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), ar) !== undefined;

describe('tour scripts', () => {
  it.each([TEACHER_TOUR, PARENT_TOUR, STUDENT_TOUR])('$id: every step has its strings and opens with a welcome card', (tour) => {
    expect(tour.steps[0].target).toBeUndefined();
    expect(tour.steps[0].cta).toBe('tour.start');
    for (const s of tour.steps) {
      expect(has(s.title)).toBe(true);
      expect(has(s.body)).toBe(true);
      if (s.cta) expect(has(s.cta)).toBe(true);
    }
    // Two minutes: a handful of stops, not a manual.
    expect(tour.steps.length).toBeGreaterThanOrEqual(8);
    expect(tour.steps.length).toBeLessThanOrEqual(12);
  });

  it('serves assistants with the teacher script and nobody else with anything', () => {
    expect(tourForRole('assistant')).toBe(TEACHER_TOUR);
    expect(tourForRole('teacher')).toBe(TEACHER_TOUR);
    expect(tourForRole('parent')).toBe(PARENT_TOUR);
    expect(tourForRole('student')).toBe(STUDENT_TOUR);
    expect(tourForRole('super_admin')).toBeNull();
    expect(tourForRole(null)).toBeNull();
  });
});

describe('nextShowable', () => {
  const steps = [
    { title: 'a', body: 'a' },
    { target: 'x', title: 'b', body: 'b' },
    { target: 'missing', title: 'c', body: 'c' },
    { target: 'routed', route: '/somewhere' as never, title: 'd', body: 'd' },
    { target: 'y', title: 'e', body: 'e' },
  ];
  const targets = { x: { x: 0, y: 0, width: 10, height: 10 }, y: { x: 0, y: 0, width: 10, height: 10 } };

  it('skips a step whose target is not on screen, keeps routed steps, ends with null', () => {
    expect(nextShowable(steps, targets, 0)).toBe(1);
    expect(nextShowable(steps, targets, 1)).toBe(3);   // 'missing' skipped; the routed one waits for its screen
    expect(nextShowable(steps, targets, 3)).toBe(4);
    expect(nextShowable(steps, targets, 4)).toBeNull();
  });

  it('walks backwards the same way', () => {
    expect(nextShowable(steps, targets, 4, -1)).toBe(3);
    expect(nextShowable(steps, targets, 3, -1)).toBe(1);
    expect(nextShowable(steps, targets, 0, -1)).toBeNull();
  });
});

describe('geometry', () => {
  const win = { width: 390, height: 844 };

  it('pads the hole and clamps it to the window', () => {
    const h = holeFor({ x: 380, y: 10, width: 40, height: 40 }, win);
    expect(h.x).toBe(372);
    expect(h.x + h.width).toBeLessThanOrEqual(win.width - 4);
    expect(h.rx).toBeLessThanOrEqual(18);
  });

  it('puts the card below the hole when there is room, above it otherwise', () => {
    const insets = { top: 47, bottom: 34 };
    expect(placeCard(holeFor({ x: 20, y: 100, width: 300, height: 60 }, win), 180, win, insets)).toMatchObject({ below: true });
    const tab = placeCard(holeFor({ x: 20, y: 790, width: 60, height: 50 }, win), 180, win, insets);
    expect(tab.below).toBe(false);
    expect(tab.top + 180).toBeLessThan(790);
  });

  it('knows when an element is scrolled away', () => {
    expect(onScreen({ x: 0, y: 100, width: 50, height: 50 }, win)).toBe(true);
    expect(onScreen({ x: 0, y: 900, width: 50, height: 50 }, win)).toBe(false);
    expect(onScreen({ x: 0, y: -80, width: 50, height: 50 }, win)).toBe(false);
  });
});
