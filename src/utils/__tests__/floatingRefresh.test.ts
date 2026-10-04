/**
 * Pull-to-refresh floats (founder 2026-10-04): every screen that passes a refreshControl
 * must take its ScrollView / FlatList / SectionList from `@/components/ui/Refreshable`,
 * never from react-native — the native iOS control drags the whole page down.
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

describe('pull-to-refresh is the floating one', () => {
  const offenders: string[] = [];
  for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]) {
    const rel = path.relative(ROOT, file);
    if (rel === path.join('src', 'components', 'ui', 'Refreshable.tsx')) continue;
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('refreshControl=')) continue;
    const rn = src.match(/import \{([^}]*)\} from 'react-native';/);
    const fromRn = rn ? rn[1].split(',').map((n) => n.trim()).filter((n) => /^(ScrollView|FlatList|SectionList)$/.test(n)) : [];
    if (fromRn.length || !src.includes("from '@/components/ui/Refreshable'")) offenders.push(`${rel} (${fromRn.join(', ') || 'no Refreshable import'})`);
  }
  it('no refreshing list comes straight from react-native', () => {
    expect(offenders).toEqual([]);
  });
});

// The pull is read from the list's own touch events. A gesture-handler recognizer around the
// list blocked the iOS edge swipe back and let a card's tap fire twice (2026-10-04).
describe('the floating refresh never claims a touch', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/components/ui/Refreshable.tsx'), 'utf8');
  it('does not use react-native-gesture-handler', () => {
    expect(src).not.toMatch(/from 'react-native-gesture-handler'/);
    expect(src).not.toMatch(/GestureDetector/);
  });
});
