import fs from 'fs';
import path from 'path';

/**
 * A hook called after a component's early `return` runs on some renders and not others — React
 * throws «Rendered more hooks than during the previous render», which is a crash in a release
 * build. It happened on 2026-11-07: `enroll.tsx` read the popup store below the course step's
 * early return, and choosing a course in QR enrolment closed the app. ESLint is not set up in this
 * repo, so this test stands in for `react-hooks/rules-of-hooks` on the one shape that bit us:
 * a top-level component body (two-space indent) with a `return` before a `use…()` call.
 */
const ROOT = path.resolve(__dirname, '../..');

/** Every .tsx under app/ and src/ outside tests (the same walk as performanceGuardrails.test.ts). */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walk(rel, out);
    } else if (/\.tsx$/.test(e.name)) {
      out.push(rel.split(path.sep).join('/'));
    }
  }
  return out;
}
const FILES = [...walk('app'), ...walk('src')];

function hooksAfterReturn(source: string): { line: number; returnedAt: number; text: string }[] {
  const lines = source.split('\n');
  const hits: { line: number; returnedAt: number; text: string }[] = [];
  let inComponent = false;
  let returnedAt: number | null = null;
  lines.forEach((l, i) => {
    if (/^(export (default )?)?function [A-Z]\w*\(/.test(l) || /^(export )?const [A-Z]\w* = (memo\()?(\(|function)/.test(l)) {
      inComponent = true;
      returnedAt = null;
      return;
    }
    if (inComponent && l.startsWith('}')) {
      inComponent = false;
      returnedAt = null;
      return;
    }
    if (!inComponent) return;
    const earlyReturn = /^ {2}(if \(.*\) return\b|return\b)/.test(l) || (/^ {2}if \(.*\) \{\s*$/.test(l) && /^ {4}return\b/.test(lines[i + 1] ?? ''));
    if (earlyReturn && returnedAt === null) returnedAt = i + 1;
    if (returnedAt !== null && /^ {2}((const|let) .*=\s*use[A-Z]\w*\(|use[A-Z]\w*\()/.test(l)) {
      hits.push({ line: i + 1, returnedAt, text: l.trim() });
    }
  });
  return hits;
}

describe('hooks are never called after an early return', () => {
  it('finds the 2026-11-07 crash shape', () => {
    const broken = [
      'export default function Screen() {',
      '  const [step] = useState(1);',
      '  if (step === 1) return null;',
      '  const open = useDialogStore((s) => s.queue.length > 0);',
      '  return null;',
      '}',
    ].join('\n');
    expect(hooksAfterReturn(broken)).toHaveLength(1);
  });

  it('no screen or component calls a hook below its early return', () => {
    const offenders = FILES.flatMap((f) =>
      hooksAfterReturn(fs.readFileSync(path.join(ROOT, f), 'utf8')).map((h) => `${f}:${h.line} (return at ${h.returnedAt}): ${h.text}`),
    );
    expect(offenders).toEqual([]);
  });
});
