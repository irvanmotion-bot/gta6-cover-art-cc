// Slanted panel grids in unit coordinates (0..1 on both axes, stretched to the export size).
// A layout is a list of column cuts, each a slanted line given as [x at top, x at bottom],
// and for every column its row cuts, each a slanted line given as [y at left edge, y at right edge].

export const LAYOUT_PRESETS = [
  {
    id: 'trio',
    name: 'Trio Slash',
    cuts: [[0, 0], [0.62, 0.5], [1, 1]],
    rows: [
      [[0, 0], [1, 1]],
      [[0, 0], [0.52, 0.42], [1, 1]],
    ],
  },
  {
    id: 'five',
    name: 'Five Alarm',
    cuts: [[0, 0], [0.37, 0.29], [0.7, 0.63], [1, 1]],
    rows: [
      [[0, 0], [0.58, 0.48], [1, 1]],
      [[0, 0], [1, 1]],
      [[0, 0], [0.34, 0.44], [1, 1]],
    ],
  },
  {
    id: 'seven',
    name: 'Seven Slant',
    cuts: [[0, 0], [0.3, 0.21], [0.57, 0.49], [0.8, 0.73], [1, 1]],
    rows: [
      [[0, 0], [0.46, 0.37], [1, 1]],
      [[0, 0], [0.6, 0.7], [1, 1]],
      [[0, 0], [0.38, 0.31], [1, 1]],
      [[0, 0], [1, 1]],
    ],
  },
  {
    id: 'marquee',
    name: 'Marquee Wide',
    cuts: [[0, 0], [0.21, 0.14], [0.41, 0.34], [0.61, 0.54], [0.81, 0.74], [1, 1]],
    rows: [
      [[0, 0], [0.5, 0.58], [1, 1]],
      [[0, 0], [1, 1]],
      [[0, 0], [0.42, 0.5], [1, 1]],
      [[0, 0], [1, 1]],
      [[0, 0], [0.56, 0.47], [1, 1]],
    ],
  },
  {
    id: 'hero',
    name: 'Hero + Strip',
    cuts: [[0, 0], [0.5, 0.66], [1, 1]],
    rows: [
      [[0, 0], [1, 1]],
      [[0, 0], [0.3, 0.26], [0.62, 0.56], [1, 1]],
    ],
  },
];

const lerp = (a, b, t) => a + (b - a) * t;

// Point on a column cut at height y (the cut runs from (top,0) to (bottom,1)).
function cutXAt(cut, y) {
  return lerp(cut[0], cut[1], y);
}

// Turns a layout preset into panel quads in pixel space for a w x h canvas.
export function buildPanelPolygons(layout, w, h) {
  const panels = [];
  for (let c = 0; c < layout.cuts.length - 1; c++) {
    const left = layout.cuts[c];
    const right = layout.cuts[c + 1];
    const rowCuts = layout.rows[c];
    for (let r = 0; r < rowCuts.length - 1; r++) {
      const top = rowCuts[r];
      const bottom = rowCuts[r + 1];
      const quad = [
        [cutXAt(left, top[0]), top[0]],
        [cutXAt(right, top[1]), top[1]],
        [cutXAt(right, bottom[1]), bottom[1]],
        [cutXAt(left, bottom[0]), bottom[0]],
      ].map(([x, y]) => [x * w, y * h]);
      panels.push(quad);
    }
  }
  return panels;
}

export function polygonBounds(poly) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function findLayout(id) {
  return LAYOUT_PRESETS.find((l) => l.id === id) ?? LAYOUT_PRESETS[0];
}
