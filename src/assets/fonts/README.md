# Brand fonts (self-hosted)

WOFF2 files for the Latin and Latin Extended subsets of the brand fonts (BRAND_GUIDE §4), copied
from the `@fontsource` v5 packages, with `fonts.css` declaring them (`font-display: swap`).

| Family | Weights | License |
|---|---|---|
| Inter | 400, 500, 600, 700, 800 | SIL Open Font License 1.1 (`OFL-Inter.txt`) |
| Plus Jakarta Sans | 500, 600, 700, 800 | SIL Open Font License 1.1 (`OFL-PlusJakartaSans.txt`) |
| JetBrains Mono | 500, 600 | SIL Open Font License 1.1 (`OFL-JetBrainsMono.txt`) |

Text in other scripts (Cyrillic, Greek, Vietnamese, ...) falls back to the system fonts in the
`--ngf-font-*` stacks in `src/styles/tokens.css`. To add a weight or subset, copy the file from the
matching `@fontsource/<family>/files/` folder and add its `@font-face` block from that package's CSS.
