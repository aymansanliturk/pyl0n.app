# PYL0N Desktop App — Build Guide

This guide covers building the PYL0N Electron desktop app into distributable
installers for Windows (.exe), macOS (.dmg), and Linux (.AppImage).

## Prerequisites

- **Node.js** 18 or later
- **Python 3** (icon generation, already run — no action needed)
- **macOS** is required to build the macOS .dmg
- **Windows or Linux** can produce the Windows .exe and Linux .AppImage

## Quick Start

```bash
# 1. Install dependencies (run once after cloning)
npm install

# 2. Run the app in development mode
npm start

# 3. Build for your platform
npm run build:win      # → dist/PYL0N Setup 1.0.0.exe
npm run build:mac      # → dist/PYL0N-1.0.0.dmg  (must run on macOS)
npm run build:linux    # → dist/PYL0N-1.0.0.AppImage
npm run build          # → all three (cross-compile where supported)
```

## Output Files

After a successful build, `dist/` will contain:

| Platform | File | Notes |
|----------|------|-------|
| Windows  | `PYL0N Setup 1.0.0.exe` | NSIS installer, x64 |
| macOS    | `PYL0N-1.0.0.dmg` | Drag-to-Applications, x64 + Apple Silicon |
| Linux    | `PYL0N-1.0.0.AppImage` | Portable, x64 |

## Icon Assets

Icons are pre-generated in `build/` using `scripts/generate-icons.py`.
To regenerate them (e.g. after a logo change):

```bash
npm run icons
# or directly:
python3 scripts/generate-icons.py
```

This creates:
- `build/icon.png`  — 512×512, used by Linux AppImage
- `build/icon.ico`  — multi-size ICO (16–256px), used by Windows NSIS
- `build/icon.icns` — multi-size ICNS (16–512px), used by macOS DMG

## Vendor Libraries (Offline Support)

The app loads XLSX, html2pdf.js, and Chart.js from CDN when online.
For a fully offline build, copy the libraries to `vendor/` before building:

```bash
npm install --save-dev xlsx@0.18.5 html2pdf.js@0.10.1 chart.js
cp node_modules/xlsx/dist/xlsx.full.min.js       vendor/
cp node_modules/html2pdf.js/dist/html2pdf.bundle.min.js vendor/
cp node_modules/chart.js/dist/chart.umd.js       vendor/
```

Then update the CDN `<script>` tags in each HTML tool to point to
`vendor/<filename>` instead of cdnjs/jsdelivr URLs.

## macOS Code Signing

For public distribution you need an Apple Developer ID certificate.
Set these environment variables before `npm run build:mac`:

```bash
export CSC_LINK="path/to/Developer-ID-Application.p12"
export CSC_KEY_PASSWORD="your-p12-password"
export APPLE_ID="your@apple.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Without signing the app will still build and run, but macOS Gatekeeper will
warn users on first launch (right-click → Open to bypass).

## Windows Code Signing

Set before `npm run build:win`:

```bash
set WIN_CSC_LINK=path\to\certificate.p12
set WIN_CSC_KEY_PASSWORD=your-p12-password
```

Without signing, Windows SmartScreen will show an "Unknown publisher" warning
on first run.

## Troubleshooting

**`Error: Cannot find module 'electron'`**
→ Run `npm install` first.

**Build fails on Windows for macOS target**
→ macOS .dmg can only be built on macOS. Use `npm run build:win` on Windows.

**Icon not showing correctly**
→ Run `npm run icons` to regenerate icon assets, then rebuild.

**App shows blank window**
→ Check DevTools console (View → Toggle Developer Tools) for JS errors.
