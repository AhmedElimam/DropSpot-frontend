import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * A RefreshControl on a scrollable whose content does not fill the screen is INERT on
 * Android: with nothing to scroll there is no pull gesture to start, so the refresh never
 * fires. `flexGrow: 1` on the contentContainerStyle makes the container fill the viewport
 * and restores the gesture — which matters most exactly when the list is EMPTY or short,
 * the case where a user is most likely to pull (an empty screen usually means a stale or
 * failed fetch, not "no data").
 *
 * This guards the whole app rather than the handful of screens that were fixed: the bug
 * is invisible in review and only shows on a real Android device with little data.
 */
const ROOTS = ['app', 'src'];
const SCROLLABLE = /<(ScrollView|FlatList|SectionList)\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** The full opening tag starting at `i`, honouring nested JSX braces. */
function openingTag(src: string, i: number): string {
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '<') depth++;
    else if (src[j] === '>' && src[j - 1] !== '=') {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return src.slice(i);
}

describe('pull-to-refresh works even when the screen is empty', () => {
  it('every scrollable with a RefreshControl grows to fill the viewport', () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8');
        if (!src.includes('RefreshControl')) continue;

        for (const m of src.matchAll(SCROLLABLE)) {
          const tag = openingTag(src, m.index!);
          if (!tag.includes('refreshControl=')) continue;
          if (tag.includes('flexGrow')) continue;

          // The style may live in a variable (contentContainerStyle={listPad}); accept it
          // when that variable carries flexGrow somewhere in the same file.
          const viaVar = /contentContainerStyle=\{([A-Za-z_$][\w$]*)\}/.exec(tag);
          if (viaVar && new RegExp(`${viaVar[1]}\\s*=\\s*\\{[^;]*flexGrow`).test(src)) continue;

          offenders.push(`${file} → <${m[1]}>`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
