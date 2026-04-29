# PYL0N Desktop App — Build Guide

This guide covers building the PYL0N Electron desktop app into a macOS `.dmg`
installer. Browser deployment needs no build — just open the `.html` files.

## Prerequisites

- **Node.js** 18 or later
- **Python 3** (icon generation; already run — no action needed unless the logo changes)
- **macOS** — required to build the `.dmg`

Windows and Linux desktop builds are no longer supported. Use the browser
version or the Cloudflare Pages deployment on those platforms.

## Quick Start

```bash
# 1. Install dependencies (run once after cloning)
npm install

# 2. Download bundled libraries and fonts into libs/ (run once)
npm run download-libs

# 3. Run the app in development mode
npm start

# 4. Build for macOS
npm run build:mac      # → dist/PYL0N-1.0.0.dmg
```

## Output Files

After a successful build, `dist/` will contain:

| File | Notes |
|------|-------|
| `PYL0N-1.0.0.dmg` | Drag-to-Applications, x64 + Apple Silicon |
| `PYL0N-1.0.0-mac.zip` | Zipped `.app`, x64 + Apple Silicon |

## Icon Assets

Icons are pre-generated in `build/` via `scripts/generate-icons.py`
(pure Python 3, no dependencies). Regenerate after a logo change:

```bash
npm run icons
# or directly:
python3 scripts/generate-icons.py
```

This creates:
- `build/icon.png`  — 512×512, general-purpose
- `build/icon.ico`  — multi-size ICO, retained for cross-platform tooling
- `build/icon.icns` — multi-size ICNS, used by the macOS DMG

## Bundled Libraries (offline)

All libraries and fonts live in `libs/` — no CDN calls at runtime. Populate
the folder once after cloning:

```bash
npm run download-libs
# or directly:
node scripts/download-libs.js
```

This downloads:

| File | Version | Used by |
|------|---------|---------|
| `libs/xlsx.full.min.js` | 0.20.3 | All tools with Excel import/export |
| `libs/html2pdf.bundle.min.js` | 0.10.1 | PDF export in all tools |
| `libs/html2canvas.min.js` | 1.4.1 | TimeCast / OrgCast PNG export |
| `libs/chart.js` | latest UMD | CashFlow, W2W Report |
| `libs/pptxgen.bundle.js` | latest | BidPack PPTX export |
| `libs/msal-browser.min.js` | latest | Cloud sync / auth (BidPack, ForeCast) |
| `libs/fonts.css` + `libs/fonts/*.woff2` | — | DM Sans + DM Mono |

`libs/` is committed so clones are immediately offline-capable; the download
script only fetches missing files.

## macOS Code Signing

For public distribution you need an Apple Developer ID certificate. Set these
environment variables before `npm run build:mac`:

```bash
export CSC_LINK="path/to/Developer-ID-Application.p12"
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="your@apple.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Without signing the app still builds and runs, but macOS Gatekeeper warns
users on first launch (right-click → Open to bypass).

## Troubleshooting

**`Error: Cannot find module 'electron'`**
→ Run `npm install` first.

**Build fails with missing asset from `libs/`**
→ Run `npm run download-libs` to populate the folder.

**Icon not showing correctly**
→ Run `npm run icons` to regenerate icon assets, then rebuild.

**App shows blank window**
→ Check DevTools (View → Toggle Developer Tools) for JS errors.
