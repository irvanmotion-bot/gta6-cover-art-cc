// Fixed scenes for the screenshots, driven by the query string:
//   ?shot=cover  draws the export PNG (the same data URL the Download button saves) alone at its native size;
//   ?shot=editor shows the editor with sample photos loaded and a panel selected.
// Params: size (square|portrait|landscape), layout, grade, photos (comma list of samples), title, tag, pos, panel.
export async function runShotFromQuery(query, app) {
  const { state } = app;
  state.sizeId = query.get('size') ?? state.sizeId;
  state.layoutId = query.get('layout') ?? state.layoutId;
  state.gradeId = query.get('grade') ?? state.gradeId;
  state.title = query.get('title') ?? state.title;
  state.tagline = query.get('tag') ?? state.tagline;
  state.captionPos = query.get('pos') ?? state.captionPos;
  state.selected = Number(query.get('panel') ?? 0);
  await app.loadSamplePhotos((query.get('photos') ?? 'woman,car,man').split(','));

  if (query.get('shot') === 'cover') {
    const size = app.EXPORT_SIZES.find((s) => s.id === state.sizeId) ?? app.EXPORT_SIZES[0];
    const img = document.getElementById('shot-image');
    img.src = app.exportCoverDataUrl(state, size.w, size.h);
    await img.decode();
    document.body.classList.add('shot-cover');
  } else {
    app.syncInputsFromState();
    app.refreshUi();
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
