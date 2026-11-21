# Sunset Panels

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/irvanmotion-bot/gta6-cover-art-cc/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/irvanmotion-bot/gta6-cover-art-cc/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A static, offline cover-art maker for crime-city-at-the-beach posters. Load your photos, type a caption, pick a
slanted multi-panel layout and a colour grade, drag each panel's photo into place, and download a PNG.

- Photos: file picker or drag-drop, several at once; read in the browser, never uploaded.
- Layouts: Trio Slash (3), Five Alarm (5), Seven Slant (7), Marquee Wide (8), Hero + Strip (4), slanted grids with thick black gutters.
- Grades: Sunset Strip, Neon Tide, Violet Dusk, Palm Gold, Full Spectrum. Each panel gets its own gradient map, plus light leak, vignette and film grain.
- Crop: click a panel, drag to pan, scroll or use the slider to zoom, pick which photo fills it.
- Caption: stacked, skewed brush lettering with outline, drop shadow and a tagline box, in three positions.
- Export: 1080 × 1080, 1080 × 1350, 1920 × 1080 PNG.

No logos, artwork or font files from any game. Lettering uses Anton (titles) and Inter (labels, UI), shipped in app/fonts/ under the SIL Open Font License (app/fonts/OFL.txt).

Run: `node serve.ts`, open http://localhost:8080. Screenshot scenes: `?shot=cover|editor` (see shots.json).
Sample photos in app/samples/ were made with an image model and are free to use.

Built for the make.fun bounty [gta6-cover-art-01](https://make.fun/bounty/gta6-cover-art-01).
