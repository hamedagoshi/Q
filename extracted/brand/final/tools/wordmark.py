"""MONAD wordmark -> vector paths (no font dependency at render time)."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = "/app/conversations/6a0730114ed513da2ad66c59/MONAD/brand/fonts/Inter.ttf"
TEXT = "MONAD"
TRACKING = 0.055     # em, uppercase display tracking
WEIGHT_AXIS = 620    # variable-font weight instance

def glyph_paths(text=TEXT, tracking=TRACKING):
    f = TTFont(FONT)
    if "fvar" in f:
        # set the variable weight axis to a solid, confident display weight
        from fontTools.varLib.instancer import instantiateVariableFont
        axes = {a.axisTag: a for a in f["fvar"].axes}
        if "wght" in axes:
            inst = instantiateVariableFont(f, {"wght": WEIGHT_AXIS}, inplace=False)
            f = inst
    upm = f["head"].unitsPerEm
    cmap = f.getBestCmap()
    gs = f.getGlyphSet()
    hmtx = f["hmtx"]
    out, x = [], 0.0
    for ch in text:
        gname = cmap.get(ord(ch))
        if not gname:
            continue
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (1, 0, 0, -1, x, 0))   # flip Y for SVG space
        gs[gname].draw(tp)
        out.append((ch, pen.getCommands(), x, upm))
        x += hmtx[gname][0] + tracking * upm
    width = x - tracking * upm
    # cap height for vertical metrics
    cap = f["OS/2"].sCapHeight if hasattr(f["OS/2"], "sCapHeight") else upm * 0.7
    return out, width, cap, upm

if __name__ == "__main__":
    glyphs, w, cap, upm = glyph_paths()
    print("glyphs:", len(glyphs), "width:", round(w), "cap:", cap, "upm:", upm)
    print("advance/width ratio:", round(w / upm, 3))
