// The editor: loads photos (picker or drag-drop), edits caption, layout, grade and per-panel crop by dragging on
// the live preview, and downloads the cover as a PNG at the chosen post size.
import { LAYOUT_PRESETS, buildPanelPolygons, findLayout, pointInPolygon, polygonBounds } from './layouts.js';
import { GRADE_PRESETS } from './grades.js';
import { renderCover, defaultPanelCrop, placePhotoInPanel, exportCoverDataUrl } from './render.js';
import { runShotFromQuery } from './shots.js';

export const EXPORT_SIZES = [
  { id: 'square', name: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', name: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'landscape', name: '1920 × 1080', w: 1920, h: 1080 },
];
const CAPTION_POSITIONS = [
  { id: 'bottom-left', name: 'Bottom left' },
  { id: 'center', name: 'Centre' },
  { id: 'bottom-right', name: 'Bottom right' },
];
const PREVIEW_LONG_SIDE = 1200;

export const state = {
  photos: [],
  photoUrls: [],
  panels: [],
  layoutId: 'seven',
  gradeId: 'sunset',
  sizeId: 'landscape',
  title: 'Sunset Heist',
  tagline: 'Coming this summer',
  captionPos: 'bottom-left',
  grain: 0.2,
  selected: 0,
};

const $ = (id) => document.getElementById(id);
const canvas = $('preview-canvas');
let panelPolys = [];

export function currentSize() {
  return EXPORT_SIZES.find((s) => s.id === state.sizeId) ?? EXPORT_SIZES[0];
}

function previewDims() {
  const { w, h } = currentSize();
  const k = PREVIEW_LONG_SIDE / Math.max(w, h);
  return [Math.round(w * k), Math.round(h * k)];
}

export function panelCount() {
  return buildPanelPolygons(findLayout(state.layoutId), 1, 1).length;
}

// Gives every panel a crop entry, spreading the loaded photos over the panels in turn.
export function resetPanelCrops() {
  state.panels = Array.from({ length: Math.max(8, panelCount()) }, (_, i) => defaultPanelCrop(i));
}

let frame = 0;
export function requestPreview() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const [w, h] = previewDims();
    panelPolys = renderCover(canvas, state, w, h, state.selected);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function addPhotoFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  const fresh = state.photos.length === 0 || state.photosAreSamples;
  if (fresh) {
    state.photos = [];
    state.photoUrls = [];
    state.photosAreSamples = false;
  }
  for (const file of images) {
    const url = URL.createObjectURL(file);
    state.photos.push(await loadImage(url));
    state.photoUrls.push(url);
  }
  if (fresh) resetPanelCrops();
  refreshUi();
}

export async function loadSamplePhotos(names) {
  const urls = names.map((n) => `samples/${n}.jpg`);
  state.photos = await Promise.all(urls.map(loadImage));
  state.photoUrls = urls;
  state.photosAreSamples = true;
  resetPanelCrops();
}

function makeChips(container, items, isActive, onPick) {
  container.replaceChildren(
    ...items.map((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = item.name;
      b.classList.toggle('active', isActive(item));
      b.addEventListener('click', () => {
        onPick(item);
        refreshUi();
      });
      return b;
    }),
  );
}

function makeThumbs(container, activeIndex, onPick) {
  container.replaceChildren(
    ...state.photoUrls.map((url, i) => {
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Photo ${i + 1}`;
      img.classList.toggle('active', i === activeIndex);
      img.addEventListener('click', () => {
        onPick(i);
        refreshUi();
      });
      return img;
    }),
  );
}

export function refreshUi() {
  makeChips($('layout-chips'), LAYOUT_PRESETS, (l) => l.id === state.layoutId, (l) => {
    state.layoutId = l.id;
    state.selected = Math.min(state.selected, panelCount() - 1);
  });
  makeChips($('grade-chips'), GRADE_PRESETS, (g) => g.id === state.gradeId, (g) => (state.gradeId = g.id));
  makeChips($('size-chips'), EXPORT_SIZES, (s) => s.id === state.sizeId, (s) => (state.sizeId = s.id));
  makeChips($('caption-pos'), CAPTION_POSITIONS, (p) => p.id === state.captionPos, (p) => (state.captionPos = p.id));
  const crop = state.panels[state.selected];
  makeThumbs($('photo-thumbs'), -1, (i) => state.panels.forEach((p) => (p.photo = i)));
  makeThumbs($('panel-photo-pick'), crop ? crop.photo % Math.max(1, state.photos.length) : -1, (i) => crop && (crop.photo = i));
  $('panel-label').textContent = `${state.selected + 1} of ${panelCount()}`;
  $('zoom-input').value = crop ? crop.zoom : 1;
  requestPreview();
}

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * canvas.width, ((e.clientY - r.top) / r.height) * canvas.height];
}

function panelAt(x, y) {
  return panelPolys.findIndex((poly) => pointInPolygon(x, y, poly));
}

// Drag on the preview: pick the panel under the pointer and pan its photo inside the panel.
function bindCanvasDrag() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = canvasPoint(e);
    const idx = panelAt(x, y);
    if (idx < 0) return;
    state.selected = idx;
    drag = { x, y };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('dragging');
    refreshUi();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [x, y] = canvasPoint(e);
    const crop = state.panels[state.selected];
    const img = state.photos[crop.photo % state.photos.length];
    if (img) {
      const b = polygonBounds(panelPolys[state.selected]);
      const { dw, dh } = placePhotoInPanel(img, b, crop);
      const slackX = Math.max(1, dw - b.w);
      const slackY = Math.max(1, dh - b.h);
      crop.ox = Math.max(-0.5, Math.min(0.5, crop.ox - (x - drag.x) / slackX));
      crop.oy = Math.max(-0.5, Math.min(0.5, crop.oy - (y - drag.y) / slackY));
    }
    drag = { x, y };
    requestPreview();
  });
  const end = () => {
    drag = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = canvasPoint(e);
    const idx = panelAt(x, y);
    if (idx < 0) return;
    state.selected = idx;
    const crop = state.panels[idx];
    crop.zoom = Math.max(1, Math.min(4, crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    refreshUi();
  }, { passive: false });
}

export function downloadCoverPng() {
  const { w, h } = currentSize();
  const a = document.createElement('a');
  a.href = exportCoverDataUrl(state, w, h);
  const slug = (state.title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  a.download = `${slug}-${w}x${h}.png`;
  a.click();
}

function bindControls() {
  const drop = $('dropzone');
  $('photo-input').addEventListener('change', (e) => addPhotoFiles(e.target.files));
  ['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  }));
  document.addEventListener('drop', (e) => addPhotoFiles(e.dataTransfer.files));
  $('title-input').addEventListener('input', (e) => { state.title = e.target.value; requestPreview(); });
  $('tagline-input').addEventListener('input', (e) => { state.tagline = e.target.value; requestPreview(); });
  $('grain-input').addEventListener('input', (e) => { state.grain = Number(e.target.value); requestPreview(); });
  $('zoom-input').addEventListener('input', (e) => {
    state.panels[state.selected].zoom = Number(e.target.value);
    requestPreview();
  });
  $('reset-panel').addEventListener('click', () => {
    state.panels[state.selected] = defaultPanelCrop(state.selected);
    refreshUi();
  });
  $('export-button').addEventListener('click', downloadCoverPng);
}

function syncInputsFromState() {
  $('title-input').value = state.title;
  $('tagline-input').value = state.tagline;
  $('grain-input').value = state.grain;
}

async function startEditor() {
  bindControls();
  bindCanvasDrag();
  const query = new URLSearchParams(location.search);
  if (query.has('shot')) {
    await runShotFromQuery(query, { state, loadSamplePhotos, refreshUi, syncInputsFromState, exportCoverDataUrl, EXPORT_SIZES });
    return;
  }
  await loadSamplePhotos(['woman', 'car', 'man']);
  syncInputsFromState();
  refreshUi();
}

startEditor();
