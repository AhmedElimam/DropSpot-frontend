# Dros Spot — mobile app: rules for every AI agent and every developer

Claude Code, Codex, Cursor, Copilot, Gemini and anyone else working here: this file is binding.
It is read automatically (CLAUDE.md imports it; `.cursor/rules` and `.github/copilot-instructions.md` point here).

## Expo version

Read the versioned Expo docs for the SDK in `package.json` before writing code. `main` is on **Expo SDK 54** (https://docs.expo.dev/versions/v54.0.0/); the `upgrade/expo-sdk-57` branch is not merged. Don't trust APIs from a newer SDK.

## Performance guardrails — NON-NEGOTIABLE

The app runs on cheap Android phones (MediaTek Helio) that overheated in 2026-09/10 until the causes were removed. Full reasons: `docs/PERFORMANCE.md`. CI (`.github/workflows/checks.yml`) fails on any of these:

1. No endless animation without `cancelAnimation` plus a pause (off-screen, scrolling, background, reduced motion). Ambient motion = short bursts. Animate `opacity`/`transform` only; never `useNativeDriver: false`; no `entering`/`exiting` on list rows.
2. Images: `expo-image`, never `react-native`'s `Image`.
3. Icons: `@expo/vector-icons/<Family>` per family, never the `@expo/vector-icons` barrel.
4. `Intl.*Format` only at module scope or via `src/utils/format.ts`.
5. `setInterval` must be cleared and ≥ 1000 ms.
6. `refetchInterval` only as `onScreen ? ≥30_000 : false`; never `refetchIntervalInBackground: true`.
7. No `watchPositionAsync` or background location.
8. `console.*` only inside `if (__DEV__)`.
9. `CameraView` needs `active={…}` or is mounted only while `isFocused`.
10. `FlatList` with windowing props; never add a new `ScrollView` + `.map` over server data.
11. No Android `elevation` per row (`ANDROID_ELEVATION = false` stays).
12. Keep `enableFreeze(true)`, `focusManager.setFocused` on AppState, `NetInfo.configure`, `freezeOnBlur: false` on every `<Stack>`, and Reanimated's `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`.
13. No `moment`, `lodash`, `lottie-react-native`, `expo-blur`, `@react-native-community/blur`, `@shopify/react-native-skia`.
14. Android export within `perf-budget.json`.

**Never** add to an `ALLOW_*` list, raise a ceiling in `src/__tests__/performanceGuardrails.test.ts`, or raise `perf-budget.json` to get a green build. Those are founder decisions. Fix the code instead, or stop and ask.

Before you finish any change: `npx tsc --noEmit && npx jest`.
