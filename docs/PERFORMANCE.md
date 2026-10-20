# Performance guardrails — mobile app

The app must stay fast and cool on the phones Egyptian teachers, assistants and parents actually carry: cheap Androids with MediaTek Helio CPUs first, iPhones second. In September and October 2026 those phones ran **hot and laggy**. The causes were found and removed one by one (endless animations, polling with the app in a pocket, network probes every 5 s, a formatter built per row, unwindowed lists, Android shadows, translucent tab bars). This page keeps them out.

**Every rule below is enforced by CI.** `.github/workflows/checks.yml` runs on every push and pull request:

- `src/__tests__/performanceGuardrails.test.ts`: the source rules
- `scripts/check-bundle-budget.js` with `perf-budget.json`: the size ceilings
- the existing guards: `boundedScenes.test.ts` (every stack sets `freezeOnBlur: false`), `androidRelease.test.ts` (R8 on), `format.test.ts` (cached formatters)

An exception is a line in an `ALLOW_*` list with its reason. **Adding to a list, raising a ceiling or a budget is a founder decision, never a way to make CI pass.** Lists only shrink; numbers only go down.

## The rules

| # | Rule | Why |
|---|---|---|
| 1 | No endless animation (`withRepeat`, `Animated.loop`) unless it stops itself (`cancelAnimation`) and pauses off-screen, while scrolling, in the background and under reduced motion. Ambient motion is a ~2 s burst every ~6 s, then zero frames. | Endless loops kept the GPU and the UI thread busy; Helio phones overheated (2026-10-08). |
| 2 | Animate only `opacity` and `transform`, on the UI thread. `useNativeDriver: false` is banned. No layout animations (`entering`/`exiting`) on list rows. | Layout and colour animation re-lays the tree every frame. |
| 3 | Images through **expo-image**, never `react-native`'s `Image`. | RN Image decodes full-resolution bitmaps with no disk cache. |
| 4 | Icons per family: `import Ionicons from '@expo/vector-icons/Ionicons'`. Never the barrel. | The barrel bundled all 15 icon fonts (5 MB → 1.4 MB when fixed). |
| 5 | `Intl` formatters are built once at module scope (or via `src/utils/format.ts`), never inside a component. | A new formatter is the most expensive JS call on Hermes, and it ran per row per render. |
| 6 | Every `setInterval` is cleared and ticks at most once a second. | Timers keep running in the background on Android. |
| 7 | Polling (`refetchInterval`) only while its screen is in front (`onScreen ? ms : false`), never faster than 30 s, never `refetchIntervalInBackground`. | Background polls kept the cellular radio awake with the screen off: the top heat cause. |
| 8 | No continuous location (`watchPositionAsync`, background location). | GPS is a heater. One-shot fixes on a tap only. |
| 9 | `console.*` only under `__DEV__`. | Logging is synchronous over the bridge in release builds. |
| 10 | A `CameraView` stops its sensor when not in view: `active={…}` or mounted only while `isFocused`. A screen with a camera sets `freezeOnBlur: false`. | A camera left running behind another tab heats the phone at the door. |
| 11 | Lists of server data use `FlatList` with windowing (`windowSize`, `initialNumToRender`, `maxToRenderPerBatch`, `removeClippedSubviews`). The number of screens that build every row at once (`ScrollView` + `.map`) may only go down. | All rows built and laid out at once = slow first paint and memory growth. |
| 12 | No Android `elevation` per row: `ANDROID_ELEVATION = false` in `src/theme/index.ts`. Raw `elevation:` only for single overlays. | Each elevated view is its own Android render layer with a rasterised shadow. |
| 13 | The app-wide wiring stays: `enableFreeze(true)`, React Query `focusManager` on `AppState`, `NetInfo.configure` at minutes, Reanimated's `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`. | Each removed one real cost; see `app/_layout.tsx` and `package.json`. |
| 14 | No `moment`, `lodash`, `lottie-react-native`, `expo-blur`/`@react-native-community/blur`, `@shopify/react-native-skia`. | Weight, or GPU cost on cheap Androids. |
| 15 | Android export within `perf-budget.json`: JS bytecode ≤ 9.6 MB, assets ≤ 2.0 MB, no single asset over 400 KB. | A bigger bundle starts slower and uses more memory. Measured 2026-10-20: 9.14 MB and 1.87 MB. |

## Habits that the tests can't see

- Memoise list rows (`React.memo`), and hoist `renderItem` and `onPress` into `useCallback`. Never declare a component inside another component's body.
- Mount heavy parts of a pushed screen after the transition (`useArrived()`).
- Zustand: atomic selectors only (`useAuthStore((s) => s.user)`).
- **Measure, don't guess.** Reports of blank frames, stutter or heat get a recording or a profile (`adb shell dumpsys gfxinfo`, a Release simulator recording) before any fix. Two blind fixes have missed already.

## Before you add a screen or a dependency

1. Server list → `FlatList` with windowing, paginated if it can grow.
2. Animation → burst, pause and stop, `opacity`/`transform` only.
3. New dependency → is it on the banned list, and what does it add to the bundle? CI will tell you; check before you build on it.
4. Run `npx jest src/__tests__/performanceGuardrails.test.ts` locally.
