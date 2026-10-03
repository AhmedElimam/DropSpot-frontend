import fs from 'fs';
import path from 'path';

/**
 * Guard for the «Rendered fewer hooks than expected» crash on sign-out (2026-10-02): the
 * teacher layout returned early for a signed-out user ABOVE two hooks, so the render after
 * logout had fewer hooks than the one before. In every app layout, no top-level hook call
 * may follow the component's first early return.
 */
const APP = path.join(__dirname, '..', '..', '..', 'app');

function layouts(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return layouts(p);
    return e.name === '_layout.tsx' ? [p] : [];
  });
}

function hooksAfterEarlyReturn(src: string): string[] {
  const body = src.slice(src.indexOf('export default function'));
  const lines = body.split('\n');
  const first = lines.findIndex((l) => /^ {2}if \(.*\) (\{|return\b)/.test(l));
  if (first < 0) return [];
  return lines.slice(first).filter((l) => /^ {2}(const|let)\b.*\buse[A-Z]\w*[<(]|^ {2}use[A-Z]\w*[<(]/.test(l));
}

describe('app layouts call every hook before any early return', () => {
  it.each(layouts(APP).map((p) => [path.relative(APP, p), p]))('%s', (_name, file) => {
    expect(hooksAfterEarlyReturn(fs.readFileSync(file as string, 'utf8'))).toEqual([]);
  });

  it('catches the original bug shape', () => {
    const bad = 'export default function L() {\n  const a = useA();\n  if (!a) {\n    return null;\n  }\n  const b = useB();\n  return b;\n}';
    expect(hooksAfterEarlyReturn(bad)).toEqual(['  const b = useB();']);
  });
});
