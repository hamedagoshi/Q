# MONAD — Phase 1.2 Implementation Report
Design System & Component Reference · tokens 1.2.0 · 2026-11-05

## 0. Source verification (done before implementation)

| Expected path | Actual | Status |
|---|---|---|
| MONAD/brand/final/ | MONAD/brand/final/ | OK |
| MONAD/brand/final/assets/ | MONAD/brand/final/assets/ (18 files) | OK |
| MONAD/brand/final/raster/ | MONAD/brand/final/raster/ (12 PNG) | OK |
| MONAD/brand/preview/ | **MONAD/brand/preview/** (not final/preview) | OK, path differs from the spec |
| MONAD/brand/final/MONAD-brand-sheet.png | present, 218 KB | OK |

Nothing was recreated or invented. The Phase 1.1 token file is the single source of truth.

## 1. Token architecture

`tools/build_tokens.py` reads `MONAD/brand/final/assets/tokens.json` and writes
`css/tokens.css`. No hex value is hand-written in any component.

Categories: colour (16 tokens × 2 themes), typography scale, font weights, font sizes,
line heights, spacing (named + numeric), radius, borders, shadows, elevation, motion,
breakpoints (documented as media queries), z-index layers, focus ring, tap target.

**Gaps found in the Phase 1.1 file and filled through the authoritative source**
(version bumped 1.1.0 → 1.2.0, fields `weight`, `leading`, `border`, `shadow`,
`breakpoint`, `z`, `focus`, `spaceNamed`, plus derived `lineStrong`, `focus`,
`overlay`, `accentSoft`): weights, numeric line heights, borders, shadows,
breakpoints, z-index, focus ring. No second colour system was introduced.

Theme: `data-theme="dark|light"` on `<html>`; `system` resolves through
`matchMedia('(prefers-color-scheme: light)')` with a live change listener. A no-JS
fallback block follows the OS preference as well.

## 2. Files created / modified

Created
- `design-system/index.html` — the component laboratory (`/design-system`)
- `design-system/tests.html` — 23 in-browser acceptance assertions
- `design-system/css/tokens.css` (generated), `css/base.css`, `css/components.css`
- `design-system/js/theme.js`, `js/ui.js`
- `design-system/tools/build_tokens.py`, `tools/run_checks.py`
- `design-system/tokens.extended.json`, `test-results.json`
- `design-system/preview/lab-{dark,light}-{rtl,ltr}-{mobile,desktop}.png`

Modified
- `brand/final/assets/tokens.json` — gap fill + version 1.2.0 (documented in §1)

Not touched: PropDesk, Expert Journal, any Phase 1.1 raster/SVG asset.

## 3. Component inventory (31)

Foundation: AppShell, PageContainer, SectionHeader, Typography, Icon wrapper, Divider
Navigation: BottomNavigation, NavigationItem, TopBar, BackButton
Actions: PrimaryButton, SecondaryButton, GhostButton, IconButton, FloatingActionButton
Data entry: TextInput, TextArea, Select, DatePicker, Toggle, Checkbox, RadioGroup
Surfaces: Card, ElevatedCard, Surface, Modal, BottomSheet
Feedback: Toast, Alert, Badge, LoadingIndicator, Skeleton, ErrorState, EmptyState

States: default, hover, pressed, focus-visible, disabled, loading, error.
RTL uses logical properties (`margin-inline`, `inset-inline`, `border-start-*`), not
right-aligned text. Directional icons are marked `.icon--directional` and mirror;
non-directional icons do not.

## 4. Test results

`chromium --headless` + `tests.html`, five viewports:

| viewport | result |
|---|---|
| 360×640 | 23/23 |
| 390×844 | 23/23 |
| 412×915 | 23/23 |
| 768×1024 | 23/23 |
| 1280×900 | 23/23 |

Assertions cover: token resolution, dark/light/system, RTL/LTR + directional icon
mirroring, all 31 components present, disabled/loading/error states, `:focus-visible`
rule, reduced-motion rule, touch targets ≥44 px, no horizontal overflow, live-theme
contrast ≥4.5, scope guard.

## 5. Acceptance criteria

1. Final MONAD identity — **PASS**
2. No MONADWAVE in product UI — **PASS** (grep across `design-system/`: none)
3. Phase 1.1 tokens authoritative — **PASS**
4. Dark theme — **PASS**
5. Light theme — **PASS**
6. System theme follows OS — **PASS (emulated)** — verified with a deterministic
   `matchMedia` stub, including a live change event; a real OS switch was not observed
7. RTL — **PASS**
8. LTR — **PASS**
9. All required components — **PASS** (31/31)
10. Component states — **PASS**
11. Mobile responsiveness — **PASS** (5 widths)
12. No horizontal overflow — **PASS**
13. Accessibility documented — **PASS**
14. Reduced motion respected — **PASS (CSS rule verified; OS emulation only)**
15. `/design-system` works — **PASS for the page**; the bare `/design-system` path
    needs the future app router — **NOT EXECUTED** as a framework route
16. No domain entities created — **PASS**
17. No Phase 1.3 functionality — **PASS**
18. PropDesk / Expert Journal untouched — **PASS** (no writes)

## 6. Known limitations

- No framework/router exists yet; the lab is a static page. `/design-system` resolves
  once the shell is served with a route (Phase 1.3).
- Fonts are referenced by family name only; the TTF files are not yet bundled into the
  design system folder, so a machine without Vazirmatn/Inter falls back to system UI.
- Breakpoints are documented as comments, since CSS custom properties cannot be used
  inside media queries.
- Toast/modal/sheet focus trapping is Escape-based; a full focus trap is not yet
  implemented (needed before real forms in Phase 2).

## 7. NOT EXECUTED

- Bare-route `/design-system` through an application router.
- Real-device Android rendering and real OS theme/reduced-motion switching.
- Automated axe/WAVE audit (checks are hand-written assertions, not a vendor audit).
- Bundling the two font families as local woff2 assets.
