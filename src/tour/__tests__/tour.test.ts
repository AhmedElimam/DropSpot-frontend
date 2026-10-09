import ar from '../../i18n/ar.json';
import { nextShowable, useTourStore } from '../store';
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
    // Two minutes: a handful of stops, not a manual — counted as each viewer sees it (the
    // teacher and the assistant each get their own ending, and only teachers see the videos).
    for (const role of [null, 'teacher', 'assistant']) {
      const seen = tour.steps.filter((s) => !role || !s.notFor?.includes(role)).length - (role ? 0 : tour.steps.filter((s) => s.notFor?.length).length);
      expect(seen).toBeGreaterThanOrEqual(8);
      expect(seen).toBeLessThanOrEqual(13);
    }
  });

  it('ends the teacher tour on «create your course», and the assistant tour without it', () => {
    const steps = TEACHER_TOUR.steps;
    const targets = Object.fromEntries(steps.filter((s) => s.target).map((s) => [s.target!, { x: 0, y: 0, width: 10, height: 10 }]));
    const lastTeacher = nextShowable(steps, targets, steps.length - 3, 1, 'teacher')!;
    expect(steps[lastTeacher].href).toBe('/(teacher)/courses/create');
    expect(nextShowable(steps, targets, lastTeacher, 1, 'teacher')).toBeNull();
    const lastAssistant = nextShowable(steps, targets, steps.length - 3, 1, 'assistant')!;
    expect(steps[lastAssistant].href).toBeUndefined();
    expect(steps[lastAssistant].title).toBe('tour.teacher.assistant_done_title');
    expect(nextShowable(steps, targets, lastAssistant, 1, 'assistant')).toBeNull();
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

describe('store', () => {
  it('starts mandatory only when asked, and forgets it on stop', () => {
    useTourStore.getState().start(TEACHER_TOUR, { mandatory: true });
    expect(useTourStore.getState().mandatory).toBe(true);
    useTourStore.getState().stop();
    expect(useTourStore.getState().mandatory).toBe(false);
    useTourStore.getState().start(TEACHER_TOUR);
    expect(useTourStore.getState().mandatory).toBe(false);
    useTourStore.getState().stop();
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

  it('pads the hole, and slides one at the edge back inside the window', () => {
    const h = holeFor({ x: 300, y: 10, width: 40, height: 40 }, win);
    expect(h).toMatchObject({ x: 292, y: 4, width: 56, height: 56 });
    expect(h.rx).toBeLessThanOrEqual(18);
    const edge = holeFor({ x: 380, y: 10, width: 40, height: 40 }, win);
    expect(edge.x + edge.width).toBeLessThanOrEqual(win.width - 4);
    expect(edge.width).toBe(56);
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

describe('spotlight on any phone (founder 2026-10-07: wrong position, slow on Xiaomi)', () => {
  const { toFrame, holePath, stackDim } = require('../geometry');

  it('moves a window-measured target into the overlay\'s own coordinates', () => {
    // An overlay that starts 24 px down (a status bar the window counts and the overlay does not).
    expect(toFrame({ x: 10, y: 124, width: 50, height: 40 }, { x: 0, y: 24, width: 390, height: 820 }))
      .toEqual({ x: 10, y: 100, width: 50, height: 40 });
  });

  it('draws the dim as one even-odd path: the screen, then the rounded hole', () => {
    const d = holePath(390, 844, 20, 100, 120, 60, 18);
    expect(d.startsWith('M0 0H390V844H0Z')).toBe(true);
    expect(d).toContain('M38 100H122A18 18 0 0 1 140 118');
    // A closed hole is just the screen.
    expect(holePath(390, 844, 195, 422, 0, 0, 18)).toBe('M0 0H390V844H0Z');
    // The corner never exceeds half the hole.
    expect(holePath(390, 844, 0, 0, 20, 10, 18)).toContain('A5 5');
  });

  it('stacks the theme dim and the extra black into one colour', () => {
    // Day: rgba(26,33,64,.5) then black .28 → alpha .64, colour scaled by .5625.
    expect(stackDim('rgba(26, 33, 64, 0.5)', 0.28)).toBe('rgba(15, 19, 36, 0.64)');
    expect(stackDim('#123456', 0.28)).toBe('#123456');
  });
});

describe('a scrolled home on replay (founder 2026-10-07)', () => {
  const { scrollNeeded } = require('../geometry');
  const area = { height: 844 };
  const top = 47; const bottom = 88 + 34;

  it('scrolls up to a target hidden above the status bar', () => {
    // 200 px scrolled: the stats now sit at y = -60.
    expect(scrollNeeded({ x: 16, y: -60, width: 358, height: 90 }, area, top, bottom)).toBe(-60 - (top + 16));
  });

  it('scrolls down to one behind the tab bar, never past its top', () => {
    expect(scrollNeeded({ x: 16, y: 700, width: 358, height: 80 }, area, top, bottom)).toBe(700 + 80 - (844 - bottom - 16));
    // Taller than the room: its top lands under the status bar, not above the screen.
    expect(scrollNeeded({ x: 16, y: 600, width: 358, height: 900 }, area, top, bottom)).toBe(600 - (top + 16));
  });

  it('leaves a target already in view alone', () => {
    expect(scrollNeeded({ x: 16, y: 200, width: 358, height: 90 }, area, top, bottom)).toBe(0);
  });

  // Founder 2026-10-07: مدام روز presents the teacher side's tour, in her own voice; the
  // parent and student tours stay as they were.
  it('is presented by مدام روز on the teacher side only', () => {
    expect(TEACHER_TOUR.narrator).toBe('rose');
    expect(PARENT_TOUR.narrator).toBeUndefined();
    expect(STUDENT_TOUR.narrator).toBeUndefined();
  });
});

describe('pinning a target while the tour scrolls it into view', () => {
  it('holds the predicted spot against mid-scroll measurements, then takes real ones again', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    const { pin, register } = useTourStore.getState();
    pin('settings:tutorials', { x: 16, y: 520, width: 360, height: 64 }, 650);
    register('settings:tutorials', { x: 16, y: 780, width: 360, height: 64 }); // mid-scroll
    expect(useTourStore.getState().targets['settings:tutorials'].y).toBe(520);
    now.mockReturnValue(1_700);
    register('settings:tutorials', { x: 16, y: 512, width: 360, height: 64 }); // landed
    expect(useTourStore.getState().targets['settings:tutorials'].y).toBe(512);
    now.mockRestore();
  });
});
