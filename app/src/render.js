// Draws the whole cover onto a canvas: graded photo panels on a slanted grid, thick black gutters, light leak,
// vignette, film grain, then the stacked caption lettering. The same function draws the live preview and the export.
import { buildPanelPolygons, polygonBounds, findLayout } from './layouts.js';
import { applyGradientMap, findGrade } from './grades.js';

// Both fonts ship as files in app/fonts/ (SIL Open Font License, see app/fonts/OFL.txt), loaded by @font-face in style.css.
export const DISPLAY_FONT = '"Anton", sans-serif';
export const LABEL_FONT = '"Inter", sans-serif';

// Canvas text silently falls back to another font if the face is not loaded yet, so drawing and export wait on this.
export const fontsReady = Promise.all([
  document.fonts.load(`64px ${DISPLAY_FONT}`, 'SUNSET'),
  document.fonts.load(`800 32px ${LABEL_FONT}`, 'Coming'),
]).catch(() => {});

const TITLE_FILLS = {
  sunset: ['#fff4d0', '#ffb43c', '#ff3d7a'],
  neon: ['#ffffff', '#ff7ad1', '#20d8ff'],
  dusk: ['#ffe6f2', '#ff8fc4', '#9b5cff'],
  palm: ['#fffbe0', '#ffd34a', '#ff7a2a'],
  mixtape: ['#fff4d0', '#ff9a3c', '#ff2ea0'],
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Default crop for panel i: when one photo fills several panels, each panel frames it differently.
export function defaultPanelCrop(i) {
  const zooms = [1, 1.6, 1.25, 2.1, 1.4, 1.8, 1.15, 2.4];
  const offs = [[0, 0], [0.18, -0.12], [-0.2, 0.1], [0.1, 0.22], [-0.16, -0.2], [0.22, 0.05], [-0.06, 0.18], [0.14, -0.22]];
  const [ox, oy] = offs[i % offs.length];
  return { photo: i, zoom: zooms[i % zooms.length], ox, oy };
}

function polygonPath(ctx, poly) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Cover-fits the photo into the panel's bounds, then applies the panel's zoom and offset (clamped so it never shows an edge).
export function placePhotoInPanel(img, bounds, crop) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(bounds.w / iw, bounds.h / ih) * Math.max(1, crop.zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  const slackX = (dw - bounds.w) / 2;
  const slackY = (dh - bounds.h) / 2;
  const dx = -slackX + Math.max(-1, Math.min(1, crop.ox * 2)) * slackX;
  const dy = -slackY + Math.max(-1, Math.min(1, crop.oy * 2)) * slackY;
  return { dx, dy, dw, dh };
}

function drawGradedPanel(ctx, img, poly, crop, stops, mix) {
  const b = polygonBounds(poly);
  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.ceil(b.w));
  off.height = Math.max(1, Math.ceil(b.h));
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.fillStyle = '#120a1e';
  octx.fillRect(0, 0, off.width, off.height);
  if (img) {
    const { dx, dy, dw, dh } = placePhotoInPanel(img, b, crop);
    octx.filter = 'contrast(1.15) saturate(1.2)';
    octx.drawImage(img, dx, dy, dw, dh);
    octx.filter = 'none';
    const data = octx.getImageData(0, 0, off.width, off.height);
    octx.putImageData(applyGradientMap(data, stops, mix), 0, 0);
  }
  // A soft sky wash from the top of every panel keeps the sunset feel even on dark photos.
  const wash = octx.createLinearGradient(0, 0, 0, off.height);
  wash.addColorStop(0, hexAlpha(stops[1], 0.28));
  wash.addColorStop(0.55, 'rgba(0,0,0,0)');
  wash.addColorStop(1, 'rgba(10,0,20,0.35)');
  octx.fillStyle = wash;
  octx.fillRect(0, 0, off.width, off.height);

  ctx.save();
  polygonPath(ctx, poly);
  ctx.clip();
  ctx.drawImage(off, b.x, b.y);
  ctx.restore();
}

function hexAlpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let grainTile = null;
function makeGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  const rnd = mulberry32(1986);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 200;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

function drawFilmGrain(ctx, w, h, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = amount;
  ctx.fillStyle = ctx.createPattern(makeGrainTile(), 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawLightLeak(ctx, w, h, grade) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const r = Math.max(w, h) * 0.75;
  const leak = ctx.createRadialGradient(w * 0.92, h * 0.05, 0, w * 0.92, h * 0.05, r);
  leak.addColorStop(0, grade.glow);
  leak.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'multiply';
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(255,255,255,1)');
  vig.addColorStop(1, 'rgba(60,20,80,1)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// Splits the caption into stacked lines: explicit line breaks win, otherwise words are balanced over up to 3 lines.
export function splitCaptionLines(text) {
  const clean = (text || '').toUpperCase().trim();
  if (!clean) return [];
  if (clean.includes('\n')) return clean.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const words = clean.split(/\s+/);
  if (words.length <= 3) return words;
  const lines = [];
  const per = Math.ceil(words.length / 3);
  for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
  return lines;
}

// One line of brush lettering: drop shadow, fat black outline, gradient fill, dry-brush streaks and a ragged edge.
function drawBrushLine(ctx, text, x, y, size, fills, rnd) {
  const pad = size * 0.4;
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  const tw = ctx.measureText(text).width;
  const off = document.createElement('canvas');
  off.width = Math.ceil(tw + pad * 2);
  off.height = Math.ceil(size * 1.5);
  const o = off.getContext('2d');
  o.font = ctx.font;
  o.textBaseline = 'alphabetic';
  const bx = pad;
  const by = size * 1.12;
  const fill = o.createLinearGradient(0, by - size * 0.9, 0, by);
  fill.addColorStop(0, fills[0]);
  fill.addColorStop(0.5, fills[1]);
  fill.addColorStop(1, fills[2]);
  o.fillStyle = fill;
  for (let k = 0; k < 3; k++) o.fillText(text, bx + (rnd() - 0.5) * size * 0.02, by + (rnd() - 0.5) * size * 0.02);
  o.globalCompositeOperation = 'source-atop';
  for (let s = 0; s < 26; s++) {
    const sy = by - size * 0.95 + rnd() * size;
    o.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(80,0,60,0.28)';
    o.fillRect(bx + rnd() * tw * 0.3, sy, tw * (0.4 + rnd() * 0.7), size * (0.008 + rnd() * 0.02));
  }

  const left = x - pad;
  const top = y - by;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.fillStyle = '#0a0410';
  ctx.strokeStyle = '#0a0410';
  ctx.lineWidth = size * 0.2;
  ctx.textBaseline = 'alphabetic';
  ctx.strokeText(text, x + size * 0.07, y + size * 0.08);
  ctx.fillText(text, x + size * 0.07, y + size * 0.08);
  ctx.lineWidth = size * 0.13;
  ctx.strokeText(text, x, y);
  ctx.drawImage(off, left, top);
  ctx.restore();
  return tw;
}

function drawTaglineBox(ctx, text, x, y, size, align) {
  if (!text) return;
  ctx.save();
  ctx.font = `800 ${size}px ${LABEL_FONT}`;
  const label = text.toUpperCase();
  const tw = ctx.measureText(label).width;
  const padX = size * 0.5;
  const bw = tw + padX * 2;
  const bh = size * 1.45;
  const bx = align === 'right' ? x - bw : align === 'center' ? x - bw / 2 : x;
  ctx.fillStyle = '#0a0410';
  ctx.beginPath();
  ctx.moveTo(bx + size * 0.3, y - bh);
  ctx.lineTo(bx + bw + size * 0.3, y - bh);
  ctx.lineTo(bx + bw - size * 0.3, y);
  ctx.lineTo(bx - size * 0.3, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3e4';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + padX, y - bh / 2 + size * 0.04);
  ctx.restore();
}

// Stacked, skewed caption block anchored to a corner or the centre of the cover.
export function drawCaptionBlock(ctx, w, h, state, grade) {
  const lines = splitCaptionLines(state.title);
  if (!lines.length && !state.tagline) return;
  const landscape = w / h > 1.2;
  const maxW = w * (landscape ? 0.52 : 0.84);
  let size = Math.min(w, h) * (landscape ? 0.2 : lines.length > 2 ? 0.15 : 0.18);
  ctx.font = `${size}px ${DISPLAY_FONT}`;
  const widest = Math.max(1, ...lines.map((l) => ctx.measureText(l).width));
  size = Math.min(size, (size * maxW) / widest);
  const lineH = size * 0.92;
  const margin = Math.min(w, h) * 0.06;
  const blockH = lines.length * lineH;
  const pos = state.captionPos || 'bottom-left';
  const align = pos.endsWith('right') ? 'right' : pos === 'center' ? 'center' : 'left';
  const baseY = pos === 'center' ? h / 2 - blockH / 2 + lineH : h - margin - blockH + lineH - size * 0.1;
  const fills = TITLE_FILLS[grade.id] ?? TITLE_FILLS.sunset;
  const rnd = mulberry32(7 + lines.join('').length);

  ctx.save();
  ctx.translate(0, 0);
  ctx.transform(1, -0.035, -0.16, 1, h * 0.12, 0);
  const tagSize = size * 0.22;
  const tagX = align === 'left' ? margin : align === 'right' ? w - margin : w / 2;
  drawTaglineBox(ctx, state.tagline, tagX, baseY - lineH - size * 0.02, tagSize, align);
  lines.forEach((line, i) => {
    ctx.font = `${size}px ${DISPLAY_FONT}`;
    const tw = ctx.measureText(line).width;
    const stagger = (i % 2) * size * 0.35;
    let x = margin + stagger;
    if (align === 'right') x = w - margin - tw - stagger;
    if (align === 'center') x = w / 2 - tw / 2 + (i % 2 ? size * 0.2 : -size * 0.2);
    drawBrushLine(ctx, line, x, baseY + i * lineH, size, fills, rnd);
  });
  ctx.restore();
}

// Renders the full cover at w x h. `selected` (preview only) outlines the panel being edited.
export function renderCover(canvas, state, w, h, selected = -1) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const layout = findLayout(state.layoutId);
  const grade = findGrade(state.gradeId);
  const polys = buildPanelPolygons(layout, w, h);
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(0, 0, w, h);

  polys.forEach((poly, i) => {
    const crop = state.panels[i] ?? defaultPanelCrop(i);
    const img = state.photos.length ? state.photos[crop.photo % state.photos.length] : null;
    drawGradedPanel(ctx, img, poly, crop, grade.maps[i % grade.maps.length], grade.mix);
  });

  drawLightLeak(ctx, w, h, grade);
  drawFilmGrain(ctx, w, h, state.grain ?? 0.2);

  const gutter = Math.min(w, h) * 0.016;
  ctx.save();
  ctx.strokeStyle = '#0a0410';
  ctx.lineWidth = gutter;
  ctx.lineJoin = 'miter';
  polys.forEach((poly) => {
    polygonPath(ctx, poly);
    ctx.stroke();
  });
  ctx.lineWidth = gutter * 2;
  ctx.strokeRect(0, 0, w, h);
  ctx.restore();

  drawCaptionBlock(ctx, w, h, state, grade);

  if (selected >= 0 && polys[selected]) {
    ctx.save();
    ctx.strokeStyle = '#22e6ff';
    ctx.lineWidth = Math.max(2, gutter * 0.4);
    ctx.setLineDash([gutter * 1.2, gutter * 0.8]);
    polygonPath(ctx, polys[selected]);
    ctx.stroke();
    ctx.restore();
  }
  return polys;
}

// Draws the cover at an export size on a fresh canvas and returns it as a PNG data URL.
export function exportCoverDataUrl(state, w, h) {
  const canvas = document.createElement('canvas');
  renderCover(canvas, state, w, h);
  return canvas.toDataURL('image/png');
}
