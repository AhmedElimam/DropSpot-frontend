/**
 * Bounded screens (src/navigation/boundedScenes.tsx): visible tabs always stay mounted, the
 * two most recently visited detail screens stay mounted, older detail screens are released.
 * Plus a guard that each role layout's VISIBLE_TABS list matches the tabs it really shows —
 * a new visible tab left out of the list would be unmounted like a detail screen.
 */
import fs from 'fs';
import path from 'path';
import { shouldKeepMounted, KEEP_RECENT_HIDDEN } from '../boundedScenes';

const VISIBLE = new Set(['index', 'students', 'manage']);
const route = (name: string) => ({ key: `${name}-key`, name });
const routes = ['index', 'students', 'manage', 'insights', 'cash-reconcile', 'venues', 'scan', 'courses'].map(route);
const hist = (...names: string[]) => names.map((n) => ({ type: 'route', key: `${n}-key` }));
const state = (focused: string, ...history: string[]) => ({
  index: routes.findIndex((r) => r.name === focused),
  routes,
  history: hist(...history, focused),
});
const keep = (s: ReturnType<typeof state>, name: string) => shouldKeepMounted(s, `${name}-key`, VISIBLE);

describe('shouldKeepMounted', () => {
  it('keeps two recent detail screens by default', () => {
    expect(KEEP_RECENT_HIDDEN).toBe(2);
  });

  it('always keeps the focused screen and every visible tab', () => {
    const s = state('venues', 'index', 'insights', 'cash-reconcile', 'scan', 'courses');
    expect(keep(s, 'venues')).toBe(true);
    for (const tab of VISIBLE) expect(keep(s, tab)).toBe(true);
  });

  it('keeps the two most recent detail screens and releases older ones', () => {
    // visited: insights → cash-reconcile → scan → courses, now on venues
    const s = state('venues', 'index', 'insights', 'cash-reconcile', 'scan', 'courses');
    expect(keep(s, 'courses')).toBe(true); // 1 back
    expect(keep(s, 'scan')).toBe(true); // 2 back
    expect(keep(s, 'cash-reconcile')).toBe(false);
    expect(keep(s, 'insights')).toBe(false);
  });

  it('visible tabs in between do not use up a slot', () => {
    // insights → students (visible) → manage (visible) → scan, now on courses
    const s = state('courses', 'insights', 'students', 'manage', 'scan');
    expect(keep(s, 'scan')).toBe(true);
    expect(keep(s, 'insights')).toBe(true);
  });

  it('Back returns to a screen exactly as it was left (it was still mounted)', () => {
    // on scan, came from courses; pressing Back pops scan and focuses courses
    const before = state('scan', 'index', 'courses');
    expect(keep(before, 'courses')).toBe(true);
    const after = state('courses', 'index');
    expect(keep(after, 'courses')).toBe(true);
  });

  it('a screen never visited (not in history) is not mounted', () => {
    expect(keep(state('index'), 'insights')).toBe(false);
  });

  it('anything unexpected keeps the screen (losing state is worse than a little memory)', () => {
    expect(shouldKeepMounted(undefined, 'insights-key', VISIBLE)).toBe(true);
    expect(shouldKeepMounted({ index: 0, routes }, 'insights-key', VISIBLE)).toBe(true); // no history
    expect(shouldKeepMounted(state('index'), 'unknown-key', VISIBLE)).toBe(true);
  });
});

describe('each role layout lists exactly its visible tabs', () => {
  for (const role of ['teacher', 'parent', 'student']) {
    it(role, () => {
      const src = fs.readFileSync(path.join(__dirname, `../../../app/(${role})/_layout.tsx`), 'utf8');
      const declared = src.match(/const VISIBLE_TABS[^=]*=\s*new Set\((\[[^\]]*\])\)/);
      expect(declared).not.toBeNull();
      const listed = new Set<string>(JSON.parse(declared![1]));

      // <Tabs.Screen name="x" /> or <Tabs.Screen name="x" options={...}> without href: null
      const shown = new Set<string>();
      const re = /<Tabs\.Screen\s+name="([^"]+)"([\s\S]*?)\/>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        if (!/href:\s*null/.test(m[2])) shown.add(m[1]);
      }

      expect([...listed].sort()).toEqual([...shown].sort());
      expect(src).toContain('screenLayout={sceneLayout}');
      expect(src).toContain('freezeOnBlur: VISIBLE_TABS.has(route.name)');
    });
  }
});
