import * as fs from 'fs';
import * as path from 'path';

/**
 * Two rules that keep both schemes (src/theme/palettes.ts) honest:
 *
 * 1. Inside a page hero (`<LinearGradient colors={gradients.hero}>`) nothing is literally
 *    white. The hero is a light mist by day and navy by night, so its text and chips go
 *    through the `onHero*` tokens. A white is allowed only on a saturated fill in the same
 *    line (a filled button, a scrim) — there it is white in both schemes.
 *
 * 2. No module-level constant captures a theme token. `colors`, `gradients`, `shadows`
 *    and `textPresets` are LIVE and rewritten on a scheme change; a `const card = {
 *    backgroundColor: colors.surface }` at the top of a file would keep the value of
 *    first import forever. Make it a function (`const card = () => ({ ... })`).
 */
const ROOT = path.resolve(__dirname, '../../..');
const SKIP_HERO = new Set(['src/components/auth/AuthScaffold.tsx', 'app/(auth)/welcome.tsx']);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' || e.name === 'node_modules' ? [] : walk(p);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

const FILES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))].map((f) => path.relative(ROOT, f));

const SATURATED = /backgroundColor: (colors\.(primary|primaryDark|success|successDark|danger|dangerDark|warning|warningDark|info|brand|brandDeep|accent|accentWarm|secondary)\b|gradients\.|'#[0-9A-Fa-f]{3,6}')|colors=\{gradients\.(primary|accent|success|warm)\}|rgba\(0,\s*0,\s*0/;
const WHITE = /'#(?:fff|FFF|ffffff|FFFFFF)'|="#(?:fff|FFF|ffffff|FFFFFF)"|colors\.white\b|colors\.textInverse\b|'rgba\(255,\s*255,\s*255,|="rgba\(255,\s*255,\s*255,/;

function openTagEnd(src: string, from: number): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && src[i - 1] !== '=') return i;
  }
  throw new Error('unterminated tag');
}

/** The inner text of every hero gradient block in `src`. */
function heroBlocks(src: string): string[] {
  const blocks: string[] = [];
  const re = /<LinearGradient\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const end = openTagEnd(src, m.index + m[0].length);
    const tag = src.slice(m.index, end + 1);
    if (!tag.includes('gradients.hero') || tag.endsWith('/>')) continue;
    let depth = 1; let j = end + 1; let close = -1;
    while (depth) {
      const o = src.indexOf('<LinearGradient', j);
      const c = src.indexOf('</LinearGradient>', j);
      if (c === -1) throw new Error('no close');
      if (o !== -1 && o < c) { depth++; j = o + 1; } else { depth--; close = c; j = c + 17; }
    }
    blocks.push(src.slice(end + 1, close));
    re.lastIndex = end + 1;
  }
  return blocks;
}

describe('page heroes carry no literal white', () => {
  const heroFiles = FILES.filter((f) => !SKIP_HERO.has(f) && fs.readFileSync(path.join(ROOT, f), 'utf8').includes('gradients.hero'));

  it('there are hero screens to check', () => expect(heroFiles.length).toBeGreaterThan(30));

  it.each(heroFiles)('%s', (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const offenders = heroBlocks(src).flatMap((b) => b.split('\n').filter((l) => WHITE.test(l) && !SATURATED.test(l)));
    expect(offenders.map((l) => l.trim())).toEqual([]);
  });
});

describe('no module-level constant captures a theme token', () => {
  const HEAD = /^(export )?const [A-Za-z_][A-Za-z0-9_]*(: [^=]+?)? = (\{|\[)/;
  const TOKEN = /\b(colors|textPresets|shadows|gradients)\./;

  it.each(FILES.filter((f) => !f.startsWith('src/theme/')))('%s', (file) => {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    const offenders: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!HEAD.test(lines[i])) continue;
      let end = i;
      if (!/[}\]]( as const)?;\s*$/.test(lines[i])) {
        while (end < lines.length && !/^[}\]]( as const)?;\s*$/.test(lines[end])) end++;
      }
      const body = lines.slice(i, end + 1).join('\n');
      if (TOKEN.test(body)) offenders.push(`${i + 1}: ${lines[i].trim().slice(0, 100)}`);
      i = end;
    }
    expect(offenders).toEqual([]);
  });
});

describe('a module-level style function is always CALLED where it is spread', () => {
  // `{ ...field }` with `const field = () => ({ … })` spreads the function — i.e. nothing —
  // and the input silently loses its border and fill (fast-register, founder 2026-10-03).
  const FN = /^(?:export )?const ([A-Za-z_][A-Za-z0-9_]*)(?:: [^=]+?)? = \(\)/gm;

  it.each(FILES)('%s', (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const names = [...src.matchAll(FN)].map((m) => m[1]);
    const offenders = names.flatMap((n) => {
      const re = new RegExp(`\\.\\.\\.${n}\\b(?!\\s*\\()`, 'g');
      return [...src.matchAll(re)].map((m) => `${n} at ${src.slice(0, m.index).split('\n').length}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe('tab bars and auth screens use the right tokens', () => {
  // The student bar is the stock one; the teacher and parent bars are NotchTabBar.
  it.each(['app/(student)/_layout.tsx'])('%s bar is tokenised', (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(src).toContain('backgroundColor: colors.tabBar');
    expect(src).toContain('colors.tabActive : colors.tabInactive');
    expect(src).not.toMatch(/backgroundColor: '#FFFFFF'/);
  });

  it('the notched bar is tokenised', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/ui/NotchTabBar.tsx'), 'utf8');
    expect(src).toContain('fill={colors.tabBar}');
    expect(src).toContain('backgroundColor: colors.tabActive');
    expect(src).toContain('colors.tabActive : colors.tabInactive');
    expect(src).not.toMatch(/backgroundColor: '#FFFFFF'/);
  });

  it.each(['app/(teacher)/_layout.tsx', 'app/(parent)/_layout.tsx'])('%s mounts the notched bar with a centre tab', (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(src).toContain('<NotchTabBar');
    expect(src).toMatch(/const CENTER_TAB = '[a-z]+'/);
    expect(src).not.toContain('<BottomTabBar');
  });

  it.each([...SKIP_HERO])('%s keeps the deep auth gradient', (file) => {
    expect(fs.readFileSync(path.join(ROOT, file), 'utf8')).toContain('gradients.auth');
  });
});

/**
 * An element that is white in BOTH schemes (`backgroundColor: '#fff'`) must not carry a
 * theme text token that flips pale in dark mode — that was «bright text on a bright
 * background» on the teacher's live-session card (founder 2026-10-03). Its ink comes from
 * `onWhite` (src/theme/onWhite.ts) or a literal dark hex. Checked within the element's own
 * tag and the few lines of children right after it.
 */
describe('always-white surfaces use fixed ink', () => {
  const FLIPPING = /colors\.(brand|primary|successText|warningText|dangerText|infoText|accentText|textPrimary|textSecondary|ink|onHero)\b/;
  const WHITE_BG = /backgroundColor:\s*['"]#(fff|FFF|ffffff|FFFFFF)['"]/;
  const offenders: string[] = [];
  for (const file of FILES.filter((f) => f.endsWith('.tsx'))) {
    const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!WHITE_BG.test(line)) return;
      // A self-closing marker (a dot) has no children.
      if (/\/>\s*\)?\s*:?\s*(null)?\s*\}?\s*$/.test(line)) return;
      // Only the element's own children: stop at the first closing tag, at most 6 lines on.
      const inside: string[] = [line];
      for (let j = i + 1; j < Math.min(lines.length, i + 7); j++) {
        if (/^\s*<\//.test(lines[j])) break;
        inside.push(lines[j]);
      }
      if (FLIPPING.test(inside.join('\n'))) offenders.push(`${file}:${i + 1}`);
    });
  }
  it('no white surface draws its text with a scheme-flipping token', () => {
    expect(offenders).toEqual([]);
  });
});
