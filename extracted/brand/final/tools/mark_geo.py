"""MONAD mark — measured reconstruction.

Measurements taken from the owner's artwork (640x640 JPEG):
  apex      y=216, centre x=331.5
  base      y=329, x 266..397  -> width 132, height 113 (aspect 1.168)
  edge/rung stroke ~2 px, base stroke ~6 px
  interior  : 5 horizontal levels, vertical dividers 0/1/2/3/4 per level
No new symbolism is introduced: only the measured geometry is redrawn cleanly.
"""
W, H = 132.0, 113.0
LEVELS = 5
STROKE = 2.0
BASE_STROKE = 6.0

def _half_width(y):
    return (W / 2) * (y / H)

def mark_paths(scale=1.0, levels=LEVELS, stroke=STROKE, base_stroke=BASE_STROKE):
    """Return (lines, stroke) lists in a W x H coordinate space."""
    lines = []
    # outer edges
    lines.append(((W/2, 0), (0, H), stroke))
    lines.append(((W/2, 0), (W, H), stroke))
    # horizontal levels
    for i in range(1, levels):
        y = H * i / levels
        hw = _half_width(y)
        lines.append(((W/2 - hw, y), (W/2 + hw, y), stroke))
    # vertical dividers inside each level: level i holds i cells
    for i in range(1, levels):
        y_top, y_bot = H * (i-1) / levels, H * i / levels
        cells = i
        for c in range(1, cells):
            fx = c / cells
            # x position at this fraction of the trapezoid at top and bottom
            hw_t, hw_b = _half_width(y_top), _half_width(y_bot)
            lines.append(((W/2 - hw_t + 2*hw_t*fx, y_top),
                          (W/2 - hw_b + 2*hw_b*fx, y_bot), stroke))
    # heavy base
    lines.append(((0, H), (W, H), base_stroke))
    return lines

def to_svg(color, pad=0.0, scale=1.0):
    w, h = W + 2*pad, H + 2*pad
    body = []
    for (x1, y1), (x2, y2), sw in mark_paths():
        body.append(f'<line x1="{x1+pad:.2f}" y1="{y1+pad:.2f}" x2="{x2+pad:.2f}" '
                    f'y2="{y2+pad:.2f}" stroke="{color}" stroke-width="{sw}" '
                    f'stroke-linecap="square"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2f} {h:.2f}" '
            f'width="{w*scale:.2f}" height="{h*scale:.2f}">' + "".join(body) + "</svg>")

if __name__ == "__main__":
    print("lines:", len(mark_paths()))
    print("aspect:", round(W/H, 4))
