/**
 * No scroll bars anywhere (founder 2026-10-04: «it shows a scrolling bar like a web page»).
 * Every ScrollView / FlatList / SectionList hides the indicator for its own direction; the
 * shared Refreshable lists default to hidden as well.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === '__tests__' || d.name === 'node_modules' ? [] : walk(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

/** The opening tag starting at `from`, braces balanced (props hold `>` inside `{…}`). */
function openingTag(src: string, from: number): string {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(from, i);
  }
  return src.slice(from);
}

describe('no web-style scroll bars', () => {
  const offenders: string[] = [];
  for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]) {
    const rel = path.relative(ROOT, file);
    if (rel.endsWith(path.join('ui', 'Refreshable.tsx'))) continue;
    const src = fs.readFileSync(file, 'utf8');
    const re = /<(Animated\.)?(ScrollView|FlatList|SectionList|BottomSheetScrollView)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const before = m.index > 0 ? src[m.index - 1] : ' ';
      if (/[\w.]/.test(before)) continue; // a type argument: useRef<ScrollView>
      const tag = openingTag(src, m.index);
      const prop = /\bhorizontal\b/.test(tag) ? 'showsHorizontalScrollIndicator' : 'showsVerticalScrollIndicator';
      if (!tag.includes(prop)) offenders.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  it('every scrolling list hides its indicator', () => {
    expect(offenders).toEqual([]);
  });
  it('the shared lists default to hidden', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/ui/Refreshable.tsx'), 'utf8');
    expect(src).toMatch(/showsVerticalScrollIndicator: false, showsHorizontalScrollIndicator: false/);
  });
});
