/**
 * Every detail screen is pushed on a STACK above the tabs, so it has the iOS edge swipe back
 * (founder 2026-10-04: «a lot of pages don't work with the back gesture»). A screen registered
 * as a hidden tab (href: null) has no back gesture — this keeps that from coming back.
 */
import * as fs from 'fs';
import * as path from 'path';

const APP = path.join(__dirname, '../../../app');

describe.each(['teacher', 'parent', 'student'])('(%s)', (role) => {
  const outer = fs.readFileSync(path.join(APP, `(${role})/_layout.tsx`), 'utf8');
  const tabs = fs.readFileSync(path.join(APP, `(${role})/(tabs)/_layout.tsx`), 'utf8');

  it('the role layout is a stack with the tabs as its first screen', () => {
    expect(outer).toMatch(/<Stack\b/);
    expect(outer).not.toMatch(/<Tabs\b/);
    expect(outer).toContain("initialRouteName: '(tabs)'");
    expect(outer).toContain('<Stack.Screen name="(tabs)" />');
  });

  it('the tab navigator holds only real tabs (no hidden href: null screens)', () => {
    expect(tabs).toMatch(/<Tabs\b/);
    expect(tabs).not.toMatch(/href:\s*null/);
  });

  it('no nested folder re-wraps its screens in a stack of their own', () => {
    const nested = fs.readdirSync(path.join(APP, `(${role})`), { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== '(tabs)')
      .filter((d) => fs.existsSync(path.join(APP, `(${role})`, d.name, '_layout.tsx')))
      .map((d) => d.name);
    expect(nested).toEqual([]);
  });
});

describe('pushed screens do not pad for a tab bar they do not have', () => {
  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) return d.name === '(tabs)' ? [] : walk(p);
      return p.endsWith('.tsx') ? [p] : [];
    });
  }
  it('only (tabs) screens use nav.bottomHeight', () => {
    const offenders = ['teacher', 'parent', 'student']
      .flatMap((r) => walk(path.join(APP, `(${r})`)))
      .filter((f) => fs.readFileSync(f, 'utf8').includes('nav.bottomHeight'))
      .map((f) => path.relative(APP, f));
    expect(offenders).toEqual([]);
  });
});
