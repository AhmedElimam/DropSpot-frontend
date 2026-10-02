import * as fs from 'fs';
import * as path from 'path';

/**
 * Nothing in app/ may navigate to `'/'`. Route groups are invisible in URLs, so from inside
 * `(teacher)` the path `/` resolves to `(teacher)/index` — the home TAB — not the root
 * router; a layout that redirects there on a role mismatch lands on itself forever (the
 * exit-from-impersonation loop, founder 2026-10-02). `/resolve` is the unambiguous name.
 */
const APP = path.resolve(__dirname, '../../../app');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

const ROOT_NAV = /href=["']\/["']|href=\{['"]\/['"]|replace\(\s*['"]\/['"]|push\(\s*['"]\/['"]|navigate\(\s*['"]\/['"]/;

describe('no screen or layout navigates to the ambiguous root path', () => {
  it.each(walk(APP).map((f) => [path.relative(APP, f), f]))('%s', (_rel, file) => {
    const src = fs.readFileSync(file, 'utf8');
    const hits = src.split('\n').map((l, i) => [i + 1, l] as const).filter(([, l]) => ROOT_NAV.test(l));
    expect(hits.map(([n, l]) => `${n}: ${l.trim()}`)).toEqual([]);
  });

  it('the unambiguous router route exists and is the root index', () => {
    expect(fs.readFileSync(path.join(APP, 'resolve.tsx'), 'utf8')).toContain("from './index'");
  });
});
