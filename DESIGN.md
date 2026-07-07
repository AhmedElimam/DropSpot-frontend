# Dros Spot — Design System Reference (Pillar 0)

Single source of truth for all three surfaces (parent app, student app, teacher dashboard).
Tokens live in `src/theme/index.ts`. **Never hardcode a hex color or font size in a screen.**

## Brand palette

| Token | Value | Meaning — used for this and ONLY this |
|---|---|---|
| `colors.primary` | `#6366F1` | Brand / primary actions / informational accents |
| `colors.success` | `#10B981` | Confirmed / present / paid / resolved. Green never means anything else. |
| `colors.warning` | `#F59E0B` | Pending / late / needs attention |
| `colors.danger` | `#EF4444` | Absent / overdue / errors / destructive |

Each has a `*Light` background tint and a `*Text` dark variant (`successText #065F46`,
`warningText #92400E`, `dangerText #991B1B`, `infoText #3730A3`) that meets WCAG AA (≥4.5:1)
on the matching light tint — badges must always pair `*Light` bg with `*Text` text.

The old blue `#208AEF` palette is **deleted**. Splash/adaptive-icon backgrounds now use `#6366F1`.

## Typography (Cairo)

- Fonts: `Cairo-Regular / Medium / Bold`, loaded in `app/_layout.tsx`, referenced via `fonts.*`.
- Use `textPresets` from the theme; parent-facing body text is **16px minimum** (`textPresets.body`),
  headings 22–26 (`h2`/`h1`). Student app may use `bodySmall` (14). Never below 12.
- Font scaling: the OS accessibility multiplier is respected but capped at **1.3×**
  (set globally on `Text`/`TextInput` defaults in `app/_layout.tsx`). Do not set
  `allowFontScaling={false}` anywhere.

## RTL

- Arabic is the only language; `I18nManager.forceRTL(true)` at the root.
- Use logical props (`marginStart/End`, `paddingStart`, `borderStartWidth`, `textAlign` unset or
  `'auto'`), never `left`/`right` margins or hardcoded `textAlign: 'left'`.
- Directional glyphs (chevrons) flip with `transform: [{ scaleX: -1 }]`.

## Touch targets

Parent app: every tappable element ≥ 48dp (`touchTarget` token). No adjacent icon-only buttons;
every icon has a text label.

## Shared components (`src/components/ui/`) — always reuse, never re-implement inline

| Component | Use |
|---|---|
| `Button` | All buttons. `variant`: primary (gradient) / secondary / outline / ghost. Has `loading`. |
| `Card` | White rounded surface with the standard shadow. |
| `Badge` | Pill label. `size`: `md` (parent default, 14px) / `sm` (dense UI, 12px). |
| `StatusBadge` | **The** way to render any domain status (attendance/ticket/invoice/session). Maps status → color meaning + Arabic label in one place. |
| `EmptyState` | Emoji + title + optional message + optional CTA. "All clear" moments, not blank screens. |
| `ErrorState` | Calm error + retry + optional "call the teacher" fallback. Never show raw API strings. |
| `SuccessConfirmation` | Full-screen green-check confirmation after important actions (elderly rule: no missable toasts). |
| `CallTeacherButton` | Visible labeled `tel:` fallback — every parent screen where someone could get stuck. |
| `LoadingSpinner` | Standard loading state with message. |

## Error copy rules (parent app)

Use `getFriendlyErrorMessage(error)` from `src/utils/errors.ts` for every mutation/query error.
It maps offline / timeout / 401 / 5xx to plain Arabic sentences. Raw server messages are shown
only for short 422 validation messages.

## Elderly-usability rules (parent app, non-negotiable)

1. One dominant primary action per screen.
2. No icon-only meaning — always a text label.
3. Core actions reachable in ≤ 2 taps.
4. Full-screen confirmations after actions, never small toasts.
5. Always a visible human fallback (call the teacher).
6. No gesture-only actions (swipe must have a button equivalent).
7. Calm, instructive error states; never technical.
