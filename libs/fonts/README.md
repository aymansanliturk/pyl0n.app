# libs/fonts/

Place DM Sans and DM Mono `.woff2` font files here.
These are generated automatically by running:

```bash
node scripts/download-libs.js
```

The script fetches the font CSS from Google Fonts, downloads all woff2 files
into this folder, and writes `libs/fonts.css` with local @font-face rules.
