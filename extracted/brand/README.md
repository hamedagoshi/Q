# MONAD / MonadWave — Brand Assets & Design Tokens (Phase 1.1, v2)

**Status:** rebuilt from the supplied MonadWave academy logo. Deterministic build,
no randomness. v1 (concentric arcs, violet palette) is superseded.

**Identity**
- Academy: **MonadWave** · Product: **MONAD**
- Mark: upright triangle, apex up, with an inverted medial triangle and one
  vertical axis; a single node at the apex.
- Lockup: "M" + triangle as the "A" + "D", with "MonadWave" set beneath.
- Taglines: fa «هر روز، یک مشاهده» · en "Observe. Record. Understand."

**Symbolism (a design requirement, not decoration)**
| Element | Meaning |
|---|---|
| three facets | three layers of existence: body, mind, self |
| inner triangle | the layers interlock; none stands alone |
| vertical axis | apex = source, base = market; one continuous line |
| apex node | every layer converges to one decision point |

## Palette

**Dark (default):** bg `#121316` · surface `#1A1C20` · surface-2 `#22252A` ·
ink cream `#F2E9D8` · dim `#A79E8E` · primary `#F26722` · light `#FF8A3D` ·
deep `#C24E12` · secondary `#F2B33D` · success `#57B87A` · danger `#E5484D`

**Light:** bg `#F7F3EA` · surface `#FFFDF8` · surface-2 `#F0E9DC` ·
ink `#1A1613` · dim `#6B6154` · primary `#D9560F` · secondary `#C98A1E` ·
success `#3F9A61` · danger `#C93B40`

## Files

| Path | Purpose |
|---|---|
| `svg/monadwave-mark-{orange,cream,mono,light}.svg` | mark variants |
| `svg/mark-{orange,cream,mono}@1024.png` | raster, transparent |
| `svg/monadwave-wordmark-{cream,orange}.svg` | academy wordmark |
| `svg/monad-wordmark-cream.svg` | product wordmark |
| `svg/monadwave-lockup-horizontal{,-light}.svg` | lockup |
| `icons/icon-{180,192,512}.png` | app icons |
| `icons/icon-{192,512}-maskable.png` | maskable (mark ≈ 50%, 80% safe zone) |
| `icons/favicon.ico` / `favicon.svg` | favicon (compact 1-facet variant at 16–32px) |
| `tokens/tokens.json` / `tokens.css` | single source of truth (dark + light + reduced-motion) |
| `preview/monadwave-brand-sheet-v2.png` | visual proof sheet |
| `build/brand_params.json` | exact geometry/colour parameters |
| `tools/build_brand_v2.py` | deterministic builder |
| `tools/compose_sheet_v2.py` | deterministic sheet composer |

## Geometry (locked)

```
canvas      240 × 240
triangle    apex (120,26) · base (24,202) – (216,202)
lattice     outer edges (13px) + medial inverted triangle (7px) + vertical axis (7px)
apex node   r = 9 units
supersample 4× Lanczos
```

Superseded v1 geometry (three concentric arcs) is no longer produced.

## Reproduction

```bash
cd MONAD/brand
python3 tools/build_brand_v2.py
python3 tools/compose_sheet_v2.py
```

## Verification performed

| Check | Method | Result |
|---|---|---|
| Triangle lattice geometry | raster to ASCII (64×64 alpha) | clean upright triangle, inner medial triangle, single axis — as designed |
| Persian shaping | Tesseract `fas` OCR of the type sample | «امروز چه چیزی را مشاهده کردی؟» read back correctly |
| Icon composition | pixel probe (corners / centre) | charcoal gradient corners, mark inside frame, no overflow |
| Token completeness | JSON parse | 8 groups, dark + light palettes, 5 type steps |
| Density check | two heavier lattice variants built, inspected, rejected | depth-2 Sierpinski and full 3-median versions were visually too dense; reverted |

## NOT EXECUTED in this step
- Component library and reference page (Phase 1.2)
- Any application screen, route or PWA shell (1.6 / 1.7)
- Icon rendering on a real Android launcher (1.7 evidence run)
- Optical kerning of the wordmark (tracking-based only)

## Fonts
Vazirmatn (SIL OFL 1.1) · Inter (SIL OFL 1.1)
