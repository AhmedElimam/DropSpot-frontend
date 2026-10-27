/**
 * PERFORMANCE GUARDRAILS — docs/PERFORMANCE.md is the why; this file is the lock.
 *
 * Every rule here is a cost the app already paid on real phones: MediaTek Helio Androids ran
 * hot and laggy (2026-09-22, 2026-10-08) until endless animations, background polling, radio
 * wake-ups, per-render formatters, unwindowed lists and Android elevation were taken out.
 * These checks read the source, so they hold whoever (or whatever tool) writes the next change.
 *
 * An exception is never silent: it is a file in one of the ALLOW lists below WITH its reason.
 * Adding to a list is a decision for the founder, not a way to make the test pass. The lists
 * may only shrink; the ratchet numbers may only go down.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walk(rel, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push(rel.split(path.sep).join('/'));
    }
  }
  return out;
}

const FILES = [...walk('app'), ...walk('src')];
const SOURCES = new Map(FILES.map((f) => [f, read(f)]));
/** Code lines only: comment lines never count as a use. */
const codeLines = (src: string) =>
  src.split('\n').map((text, i) => ({ text, n: i + 1 })).filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text));
const filesMatching = (re: RegExp) => FILES.filter((f) => codeLines(SOURCES.get(f)!).some(({ text }) => re.test(text)));
const unexpected = (found: string[], allow: Record<string, string>) => found.filter((f) => !(f in allow));

// ── Exceptions, each with its reason ─────────────────────────────────────────────────────────

/** Endless/repeating animations: only with a stop (cancelAnimation) AND a pause signal. */
const ALLOW_REPEAT: Record<string, string> = {
  'src/components/ui/ConnectionStatus.tsx': 'sync arrows turn only while a sync pass is sending, cancelAnimation otherwise, off under reduced motion',
  'src/components/rose/RoseLive.tsx': "Rose's talk loop, paused by useRoseHold while scrolling / out of sight; only on her own page",
};
/** react-native's Image (no disk cache, full-res decode): expo-image everywhere else. */
const ALLOW_RN_IMAGE: Record<string, string> = {
  'app/_layout.tsx': 'baseline 2026-10-20: the hydration splash logo, a bundled asset shown once',
  'src/components/ui/BrandMark.tsx': 'baseline 2026-10-20: small bundled logo — move to expo-image when touched',
  'src/components/complaints/AnnotatedPhoto.tsx': 'baseline 2026-10-20: one photo on a detail screen — move to expo-image when touched',
  'src/components/complaints/PhotoAnnotator.tsx': 'baseline 2026-10-20: needs onLayout sizing of one photo — move to expo-image when touched',
  'src/components/SeasonCrest.tsx': 'baseline 2026-10-20: small bundled crest — move to expo-image when touched',
};
/** A CameraView must stop its sensor when not in view: `active=` or mounted only while focused. */
const ALLOW_CAMERA: Record<string, string> = {
  'src/components/session/QRScanner.tsx': 'unused component (no importer, 2026-10-20) — gate the camera before using it anywhere',
};
/** FlatLists without windowing props (windowSize / initialNumToRender / maxToRenderPerBatch). */
const ALLOW_FLATLIST: Record<string, string> = {
  'app/(teacher)/search.tsx': 'baseline 2026-10-20: add windowing when touched',
  'app/(teacher)/(tabs)/sessions.tsx': 'baseline 2026-10-20: add windowing when touched',
  'app/(teacher)/revisions.tsx': 'baseline 2026-10-20: add windowing when touched',
  'app/(teacher)/complaints.tsx': 'baseline 2026-10-20: add windowing when touched',
  'app/(teacher)/cash-collections.tsx': 'baseline 2026-10-20: add windowing when touched',
};
/** Raw `elevation:` outside the theme (an Android render layer each; the theme turns them off). */
const ALLOW_ELEVATION: Record<string, string> = {
  'src/theme/index.ts': 'the one switch: ANDROID_ELEVATION = false',
  'src/ui/dialog.tsx': 'stacking order for the dialog host overlay (one view, not per row)',
  'src/components/ui/SheetModal.tsx': 'stacking order for the inline sheet overlay (one view)',
  'app/(teacher)/pending-collections.tsx': 'one floating action bar, not per row',
};
/** Reanimated layout animations (entering/exiting) — never on list rows. */
const ALLOW_LAYOUT_ANIM: Record<string, string> = {
  'src/components/rose/RoseProps.tsx': "Rose's props on her own page",
  'src/components/OfflinePill.tsx': 'one pill appearing/disappearing',
  'src/components/teacher/AssistantRank.tsx': 'one rank badge',
};
/** Screens rendering lists with ScrollView + .map (all rows built at once). Ratchet: may only go down. */
const SCROLLVIEW_MAP_FILES_MAX = 77;
/** Dependencies that cost Helio phones frames or heat, or the bundle weight. */
const BANNED_DEPENDENCIES = ['moment', 'lodash', 'lottie-react-native', 'expo-blur', '@react-native-community/blur', '@shopify/react-native-skia'];

// ── Rules ────────────────────────────────────────────────────────────────────────────────────

describe('performance guardrails (docs/PERFORMANCE.md)', () => {
  it('endless animations only where they stop and pause by themselves', () => {
    const repeats = filesMatching(/withRepeat\(/);
    expect(unexpected(repeats, ALLOW_REPEAT)).toEqual([]);
    for (const f of repeats) expect([f, /cancelAnimation\(/.test(SOURCES.get(f)!)]).toEqual([f, true]);
    expect(filesMatching(/Animated\.loop\(/)).toEqual([]);
    expect(filesMatching(/useNativeDriver:\s*false/)).toEqual([]);
  });

  it('reanimated layout animations stay off list rows', () => {
    expect(unexpected(filesMatching(/\b(entering|exiting)=\{/), ALLOW_LAYOUT_ANIM)).toEqual([]);
  });

  it("images go through expo-image, not react-native's Image", () => {
    expect(unexpected(filesMatching(/import\s*\{[^}]*\bImage\b[^}]*\}\s*from\s*'react-native'/), ALLOW_RN_IMAGE)).toEqual([]);
  });

  it('icons are imported per family, never the @expo/vector-icons barrel (5 MB of fonts)', () => {
    expect(filesMatching(/from\s*'@expo\/vector-icons'/)).toEqual([]);
  });

  it('Intl formatters are built once at module scope, never per render', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const { text, n } of codeLines(SOURCES.get(f)!)) {
        if (/new Intl\./.test(text) && !/^(export )?const [A-Z_0-9]+\s*=/.test(text) && !f.endsWith('src/utils/format.ts')) bad.push(`${f}:${n}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every interval is cleared and ticks at most once a second', () => {
    const bad: string[] = [];
    for (const f of filesMatching(/setInterval\(/)) {
      const src = SOURCES.get(f)!;
      if (!/clearInterval\(/.test(src)) bad.push(`${f}: setInterval without clearInterval`);
      for (const { text, n } of codeLines(src)) {
        const m = text.match(/setInterval\(.*,\s*([0-9_]+)\s*\)/);
        if (m && Number(m[1].replace(/_/g, '')) < 1000) bad.push(`${f}:${n}: ${m[1]} ms`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('polling runs only while its screen is in front, never in the background, never faster than 30 s', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const { text, n } of codeLines(SOURCES.get(f)!)) {
        if (/refetchIntervalInBackground:\s*true/.test(text)) bad.push(`${f}:${n}: refetchIntervalInBackground`);
        const m = text.match(/refetchInterval:\s*(.+)/);
        if (!m || /^false\b/.test(m[1])) continue;
        if (!/\?.*:\s*false/.test(m[1])) bad.push(`${f}:${n}: refetchInterval not gated on the screen being in front`);
        for (const num of m[1].match(/\b[0-9][0-9_]*\b/g) ?? []) {
          if (Number(num.replace(/_/g, '')) < 30_000) bad.push(`${f}:${n}: ${num} ms`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('no continuous location tracking', () => {
    expect(filesMatching(/watchPositionAsync|startLocationUpdatesAsync/)).toEqual([]);
  });

  it('console output only in development builds', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      const lines = SOURCES.get(f)!.split('\n');
      lines.forEach((text, i) => {
        if (!/console\.(log|info|debug)\(/.test(text) || /^\s*(\/\/|\*)/.test(text)) return;
        const guard = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (!/__DEV__/.test(guard)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('the camera sensor stops when its screen is not in view', () => {
    const bad = FILES.filter((f) => {
      const lines = SOURCES.get(f)!.split('\n');
      return lines.some((text, i) => {
        if (!/<CameraView\b/.test(text)) return false;
        const around = lines.slice(Math.max(0, i - 3), i + 15).join('\n');
        return !/\bactive=\{/.test(around) && !/isFocused\s*(\?|&&)/.test(around);
      });
    });
    expect(unexpected(bad, ALLOW_CAMERA)).toEqual([]);
  });

  it('lists are windowed', () => {
    const bad = filesMatching(/<FlatList\b/).filter((f) => !/windowSize|initialNumToRender|maxToRenderPerBatch/.test(SOURCES.get(f)!));
    expect(unexpected(bad, ALLOW_FLATLIST)).toEqual([]);
  });

  it('screens that build every row at once (ScrollView + .map) may only become fewer', () => {
    const n = FILES.filter((f) => f.endsWith('.tsx') && /<ScrollView\b/.test(SOURCES.get(f)!) && /\.map\(/.test(SOURCES.get(f)!)).length;
    expect(n).toBeLessThanOrEqual(SCROLLVIEW_MAP_FILES_MAX);
  });

  it('Android elevation stays off: only the theme switch and single overlays', () => {
    expect(read('src/theme/index.ts')).toMatch(/const ANDROID_ELEVATION = false;/);
    expect(unexpected(filesMatching(/\belevation:\s*\d/), ALLOW_ELEVATION)).toEqual([]);
  });

  it('the app-wide wiring that stopped the heat stays in place', () => {
    const layout = read('app/_layout.tsx');
    // Hidden tabs frozen; React Query told when the app is in the background (or every poll
    // keeps the radio awake in a pocket); NetInfo probing at minutes, not seconds.
    expect(layout).toMatch(/enableFreeze\(true\)/);
    expect(layout).toMatch(/focusManager\.setFocused\(/);
    expect(layout).toMatch(/NetInfo\.configure\(/);
    // Reanimated applies UI-thread frames without a full ShadowTree commit on Android.
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.reanimated?.staticFeatureFlags?.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS).toBe(true);
  });

  it('no dependency known to cost frames, heat or megabytes', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => BANNED_DEPENDENCIES.includes(d))).toEqual([]);
  });

  it('every exception still exists (a fixed file leaves its list)', () => {
    const stale = [ALLOW_REPEAT, ALLOW_RN_IMAGE, ALLOW_CAMERA, ALLOW_FLATLIST, ALLOW_ELEVATION, ALLOW_LAYOUT_ANIM]
      .flatMap((list) => Object.keys(list))
      .filter((f) => !SOURCES.has(f));
    expect(stale).toEqual([]);
  });
});
