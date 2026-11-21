// Colour grades: each preset is a set of gradient maps (shadow -> mid -> highlight) that the panels take in turn,
// so neighbouring panels get different looks, plus a glow colour for the light leak over the whole cover.

export const GRADE_PRESETS = [
  {
    id: 'sunset',
    name: 'Sunset Strip',
    mix: 0.82,
    glow: 'rgba(255,140,60,0.55)',
    maps: [
      ['#1b0630', '#e8432f', '#ffd27a'],
      ['#2a0638', '#ff3f8e', '#ffe0c2'],
      ['#3a0a1a', '#ff7a1a', '#fff1b0'],
      ['#160b3d', '#c23cff', '#ffc2a8'],
    ],
  },
  {
    id: 'neon',
    name: 'Neon Tide',
    mix: 0.86,
    glow: 'rgba(255,46,160,0.5)',
    maps: [
      ['#0c0026', '#ff2ea0', '#ffe6f6'],
      ['#001628', '#00d7ff', '#eaffff'],
      ['#14002e', '#a34bff', '#ffd9ff'],
      ['#00201c', '#14f0b4', '#f4fff0'],
    ],
  },
  {
    id: 'dusk',
    name: 'Violet Dusk',
    mix: 0.8,
    glow: 'rgba(170,90,255,0.5)',
    maps: [
      ['#120626', '#7b3cc8', '#ffb8d8'],
      ['#1a0a2a', '#d24a8c', '#ffd7b0'],
      ['#081236', '#4a6cff', '#ffc9f0'],
    ],
  },
  {
    id: 'palm',
    name: 'Palm Gold',
    mix: 0.75,
    glow: 'rgba(255,200,80,0.45)',
    maps: [
      ['#03222a', '#0fa39a', '#ffe9a0'],
      ['#2a1204', '#f0921e', '#fff4c8'],
      ['#0a1e3a', '#2fb7d6', '#ffe0a8'],
    ],
  },
  {
    id: 'mixtape',
    name: 'Full Spectrum',
    mix: 0.85,
    glow: 'rgba(255,120,90,0.5)',
    maps: [
      ['#1b0630', '#e8432f', '#ffd27a'],
      ['#001628', '#00d7ff', '#eaffff'],
      ['#14002e', '#ff2ea0', '#ffe6f6'],
      ['#120626', '#7b3cc8', '#ffb8d8'],
      ['#03222a', '#0fa39a', '#ffe9a0'],
    ],
  },
];

export function findGrade(id) {
  return GRADE_PRESETS.find((g) => g.id === id) ?? GRADE_PRESETS[0];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const lutCache = new Map();

// 256-entry RGB lookup from luminance to the gradient map's colour, with a gentle S-curve for punch.
export function buildGradientLut(stops) {
  const key = stops.join();
  if (lutCache.has(key)) return lutCache.get(key);
  const rgb = stops.map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    let t = i / 255;
    t = t * t * (3 - 2 * t) * 0.7 + t * 0.3;
    const seg = t < 0.5 ? 0 : 1;
    const local = seg === 0 ? t * 2 : (t - 0.5) * 2;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[seg][c] + (rgb[seg + 1][c] - rgb[seg][c]) * local;
  }
  lutCache.set(key, lut);
  return lut;
}

// Duotone/gradient-map the pixels in place, blended over the original by `mix`.
export function applyGradientMap(imageData, stops, mix) {
  const lut = buildGradientLut(stops);
  const d = imageData.data;
  const keep = 1 - mix;
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    const k = l * 3;
    d[i] = d[i] * keep + lut[k] * mix;
    d[i + 1] = d[i + 1] * keep + lut[k + 1] * mix;
    d[i + 2] = d[i + 2] * keep + lut[k + 2] * mix;
  }
  return imageData;
}
