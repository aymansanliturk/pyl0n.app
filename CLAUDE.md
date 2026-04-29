# CLAUDE.md — PYL0N Suite (pyl0n.app)

This file documents the codebase structure, conventions, and workflows for AI assistants working on this project.

## Project Overview

**PYL0N** is a bid and project planning suite available in three deployment modes:
- **Browser** — open any `.html` file directly, no installation
- **Electron desktop app** — packaged `.dmg` for macOS (x64 + Apple Silicon) via electron-builder
- **Cloudflare Pages** — static hosting from the repo; security headers enforced via `_headers`

The suite consists of fifteen specialized planning tools plus a landing page.

## Tools in the Suite

| File | Tool Name | Purpose |
|------|-----------|---------|
| `index.html` | Landing page / Dashboard | Navigation hub with cards, suite-wide masterImport/masterExport |
| `timecast.html` | TimeCast | Multi-project Gantt timeline with baseline tracking and dynamic scale |
| `resourcecast.html` | ResourceCast | Team resource allocation, FTE calculations, cost planning |
| `orgcast.html` | OrgCast | Organization chart generator with SVG connectors |
| `rfqcast.html` | RFQCast | Supplier RFQ tracking dashboard |
| `dorcast.html` | DORCast | RACI/DOR responsibility matrix builder |
| `riskcast.html` | RiskCast | Risk & opportunity register with scoring matrix |
| `calccast.html` | CalcCast | Cost breakdown calculator; receives winning quotes pushed from RFQCast |
| `lettercast.html` | LetterCast | Commercial cover letter / offer document generator with dynamic sections |
| `cashflow.html` | CashFlow | Monthly cash-flow simulation with per-item cost distribution and cancellation curve |
| `w2w-report.html` | W2W Report | Wall-to-Wall financial report; factory-level KPI breakdown consolidated into a business area summary table |
| `cvcast.html` | CVCast | Curriculum vitae / résumé generator with experience, education, skills, languages, and A4 PDF export |
| `forecast.html` | ForeCast | Pipeline & overlap monitor with Salesforce Excel importer; per-quarter analysis and Bid Manager workload cards |
| `bidscore.html` | BidScore | Bid / No-Bid decision tool with weighted scoring criteria and live verdict gauge |
| `actionlog.html` | ActionLog | Bid action tracker with category, owner, priority, due date, and status |
| `bidpack.html` | BidPack | Bid package assembler — pulls live data from all suite tools into a single PDF, PPTX, or standalone HTML document |
| `favicon.svg` | — | Brand favicon |
| `logo.svg` | — | Brand logo (34×34px grid) |

## Architecture

### Dual-mode: Browser + Electron

HTML tools run directly in a browser with no build step. The same files are also packaged into an Electron desktop app. Electron-specific behaviour is always gated:
```js
if (window.electronAPI) { /* native dialog */ } else { /* blob download fallback */ }
```
Never break the browser fallback path when adding Electron features.

### Monolithic HTML Files

Each tool lives entirely within a single `.html` file:
- `<style>` blocks contain all CSS (no external stylesheets)
- `<script>` blocks contain all JavaScript (no external JS files)
- HTML markup, styles, and logic are co-located per tool

### Local Libraries (fully offline)

All libraries live in `libs/` — no CDN calls at runtime:

| File | Version | Used by |
|------|---------|---------|
| `libs/xlsx.full.min.js` | 0.20.3 | All tools with Excel export/import |
| `libs/html2pdf.bundle.min.js` | 0.10.1 | PDF export in all tools |
| `libs/html2canvas.min.js` | 1.4.1 | `timecast.html` and `orgcast.html` PNG export |
| `libs/chart.js` | latest UMD | `cashflow.html`, `w2w-report.html` |
| `libs/pptxgen.bundle.js` | latest | `bidpack.html` PPTX export |
| `libs/msal-browser.min.js` | latest | Cloud sync / auth (`bidpack.html`, `forecast.html`) |
| `libs/fonts.css` | — | Local @font-face rules for DM Sans + DM Mono |
| `libs/fonts/*.woff2` | — | DM Sans (300–700, italic) + DM Mono (400,500) |

Run `node scripts/download-libs.js` once after cloning to populate `libs/`. The `libs/` directory is committed to the repo so clones are immediately offline-capable.

### vendor/pyl0n-native.js

Shared bridge script included in every tool's `<head>`. Provides native OS file dialog wrappers that call `window.electronAPI` when running in Electron, with silent browser blob-download fallback otherwise:
- `nativeSaveText(filename, content, filterName, ext)`
- `nativeSaveXLSX(wb, filename)` — uses `XLSX.write(..., {type:'base64'})` + IPC
- `nativeSavePDF(el, filename, opts)` — html2pdf blob → base64 → IPC
- `nativeSaveHTML(filename, htmlContent)`
- `nativeOpenText(extensions, callback, fallbackInput)`
- `nativeOpenBinary(extensions, callback, fallbackInput)`

All export functions in every tool are `async` and call these helpers.

### Client-Side Storage

All data persists in the browser via `localStorage`. Active key prefix is `bidcast_`:
- `bidcast_logo` — company logo (base64-encoded data URL, shared across suite)
- `bidcast_suite_sync` — shared state object for cross-tool sync
- `bidcast_state_<toolname>` — per-tool state JSON

**`migrate()` in SuiteManager**: Scans `localStorage` for any `pyl0n_` keys (from an older rebrand), maps them to `bidcast_` equivalents, and deletes the old keys — run once on page load to ensure backward compatibility.

**`masterImport` dual-prefix**: `index.html` accepts archive JSON files with either `bidcast_` or legacy `pyl0n_` keys, remapping the old prefix on restore.

No cookies, no IndexedDB, no server storage.

## Code Conventions

### File Structure Per Tool

Each tool HTML file follows this layout:
1. `<!DOCTYPE html>` + `<head>` with `<script src="libs/...">` tags for bundled libraries, `<link rel="stylesheet" href="libs/fonts.css">` for local fonts, and `<script src="vendor/pyl0n-native.js">` for the file-I/O bridge
2. `<style>` block with all CSS
3. `<body>` containing:
   - `#toolbar` — top action bar (save/load/export buttons)
   - `#editor` — interactive input section (screen-only)
   - `#output` — print-optimized rendered output
4. `<script>` block with all JavaScript

### Naming Conventions

- **HTML IDs**: kebab-case (e.g., `#proj-name`, `#chart-title`, `#suite-sync-badge`)
- **CSS classes**: kebab-case (e.g., `.phase-chip`, `.btn-add`, `.drag-handle`)
- **JavaScript functions**: camelCase (e.g., `saveLogo()`, `addPerson()`, `exportPDF()`)
- **Data attributes**: `data-fmt`, `data-idx` (used for drag-and-drop)
- **localStorage keys**: prefixed with `bidcast_`

### CSS Custom Properties

Colors and spacing are defined as CSS variables in the `:root` selector:
```css
:root {
  --bg: #f5f4f0;
  --surface: #ffffff;
  --border: #e0ddd6;
  --text: #1a1916;
  --accent: #2c4e87;
  --green: #107c41;
}
```
Always use these variables for colors — do not hardcode hex values outside of the `:root` block.

### State Management Pattern

Each tool uses a consistent `collectState()` / `applyState()` pattern:
- `collectState()` — reads all form inputs and returns a plain JSON object
- `applyState(state)` — populates all form inputs from a JSON object; always calls `generate()` at the end
- `saveJSON()` — calls `collectState()`, writes to localStorage and triggers file download
- `loadJSON()` — parses uploaded `.json` file and calls `applyState()`
- `exportHTML()` — creates a fully self-contained HTML snapshot with state embedded as base64

**Important (TimeCast):** `applyState()` calls `generate()` which hides the editor. The `DOMContentLoaded` auto-restore block explicitly forces `editor.style.display = 'block'` after calling `applyState()` to keep the editor visible on initial load.

### Undo/Redo System

Each tool maintains an in-memory history stack:
- `_snapshot()` — takes an immediate state snapshot
- `_scheduleSnap()` — debounced snapshot (for text inputs)
- `undo()` — restores previous state
- `redo()` — replays next state

### Drag and Drop

Row reordering uses the native HTML5 drag API:
- `.drag-handle` — the grip element on each row
- `.dragging` — applied to the row being dragged
- `.drag-over` — applied to the drop target row
- Data attribute `data-idx` carries the source row index

### Suite Sync

Timecast → ResourceCast → OrgCast share data automatically:
- Timecast phases sync to ResourceCast phase columns
- ResourceCast roles sync to OrgCast team member list
- Sync state is serialized to `localStorage['bidcast_suite_sync']`
- A `#suite-sync-badge` element indicates sync availability

## Export Formats

| Format | Library | Function |
|--------|---------|----------|
| PDF | html2pdf.js | `exportPDF()` |
| Excel (.xlsx) | XLSX | `exportExcel()` or `exportXLSX()` |
| JSON (data backup) | Built-in | `saveJSON()` |
| Standalone HTML | Built-in | `exportHTML()` |

All exported files include a footer watermark: `"Generated with [TOOL] · [tagline]"`

Print layouts target **A4 portrait** or **A3 landscape** depending on the tool.

## Data Types and Enums

### Task/Row Types (Timecast, ResourceCast)
- `TASK` — standard work item
- `MILESTONE` — zero-duration point in time
- `LABOUR` — human resource cost line
- `EXPENSE` — non-labour cost line

### Risk Type (RiskCast)
- `risk` — renders score badge with severity color (green/amber/red)
- `opportunity` — always renders green badge labeled "Gain" regardless of score

### RFQ Status (RFQCast)
- `none` — not started
- `enquiry` — sent to supplier
- `waiting` — awaiting response
- `received` — quote received
- `expired` — validity date passed
- `binding` — binding quote accepted

### Responsibility Codes (DORCast)
- `D` — Decision maker
- `O` — Owner / accountable
- `R` — Responsible / doing the work
- `S` — Support / contributor
- `I` — Informed

## Development Workflow

### Running Locally (browser)

No installation required. Open any `.html` file directly in a browser:
```bash
open timecast.html
# or serve all tools:
python3 -m http.server 8080   # visit http://localhost:8080
```

### Running as Electron app (dev mode)

```bash
npm install        # first time only
npm start          # opens the app in Electron with DevTools available
```
The desktop app has no auth gate — it boots directly into `index.html` and
persists user data in the Chromium `persist:pyl0n` session partition.

### Making Changes

1. Edit the relevant `.html` file directly
2. Reload the browser (or restart `npm start`) to test
3. All CSS and JS is inline — no compilation step
4. Test export formats (PDF, Excel, JSON, HTML) after logic changes

### Version Badge Convention

The `<footer>` in `index.html` carries a `v2.0.0`-style badge (DM Mono pill, `var(--border)` / `var(--muted)`).

**Rule: bump the patch version (`v2.0.X`) at the end of every feature-phase task.** If the work adds a major new tool or a cross-cutting architectural change, bump the minor version instead (`v2.X.0`). Update the badge in the same commit as the feature work — do not create a separate version-bump commit.

Current version: `v2.0.1` (Phase 113 — native PowerPoint export for BidPack)

### Git Workflow

- Main branch: `master`
- Feature branches: `claude/<description>-<id>`
- Commit messages: conventional commits format — `feat(tool):`, `fix(tool):`, `refactor:`, etc.
- Commits are signed with SSH key (`/home/claude/.ssh/commit_signing_key.pub`)

### Publishing a Release

```bash
git add .
git commit -m "feat: description"
git push
git tag v1.x.x
git push origin v1.x.x
```
Pushing a tag triggers `.github/workflows/build.yml` to build the macOS `.dmg` and `.zip` on a `macos-latest` runner and publish them as a GitHub Release. There is no auto-updater — users download new releases manually.

### What NOT to Do

- Do not add TypeScript — the project is intentionally vanilla JS
- Do not create separate `.css` or `.js` files — keep styles and scripts inline in each HTML file
- Do not add a backend or server component unless explicitly requested
- Do not add testing frameworks without explicit request
- Do not use `localStorage` keys outside the `bidcast_` prefix namespace
- Do not reference CDN URLs for libraries — use `libs/` local paths only
- Do not break the browser fallback in export functions — always keep the `else` blob-download path

## Electron Desktop App

### Key Files

| File | Purpose |
|------|---------|
| `main.js` | Electron main process — BrowserWindow, IPC handlers |
| `preload.js` | contextBridge — exposes `window.electronAPI` to renderer pages |
| `vendor/pyl0n-native.js` | Native file dialog helpers included in every tool |

The Electron app has no auth, no obfuscation, and no auto-updater. It is a
thin wrapper that loads `index.html` and exposes five IPC channels for
native file I/O.

### IPC Handlers (main.js)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dialog:saveFile` | renderer → main | Native Save dialog |
| `dialog:openFile` | renderer → main | Native Open dialog |
| `fs:writeFile` | renderer → main | Write file; `encoding='base64'` for binary (xlsx, pdf) |
| `fs:readFile` | renderer → main | Read file as UTF-8 string |
| `app:getVersion` | renderer → main | Returns app version string |

### Build & Packaging

```bash
npm run icons          # regenerate build/icon.png/.ico/.icns from SVG geometry
npm run download-libs  # download all JS libs + fonts into libs/ (run once)
npm run build:mac      # electron-builder → dist/*.dmg + dist/*.zip
```

Only macOS builds are supported. The repo has no prebuild / obfuscation step
— electron-builder packages the repo root (`*.html`, `libs/**`, `vendor/**`,
`main.js`, `preload.js`, `build/icon.*`) as-is per `package.json > build.files`.

### Icon Generation (scripts/generate-icons.py)

Pure Python 3 (no dependencies). Renders the PYL0N 4-square navy logo at
16/32/64/128/256/512px using struct+zlib PNG encoding, writes:
- `build/icon.png` — 512×512, general-purpose
- `build/icon.ico` — multi-size ICO, retained for cross-platform tooling
- `build/icon.icns` — multi-size ICNS, used by the macOS DMG

Run: `npm run icons` or `python3 scripts/generate-icons.py`

## Web Deployment

### Cloudflare Pages

The suite is deployed as static files via Cloudflare Pages. No build step —
HTML files are served from the repo as-is. Security headers are enforced by
the repo-root `_headers` file:

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
```

There is no authentication layer on the web deployment — any visitor with
the URL can open the tools. Sensitive data never leaves the browser
(`localStorage` only).

### GitHub Actions Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/build.yml` | Push tag `v*.*.*` (or manual dispatch) | Build `.dmg` + `.zip` on macOS, publish GitHub Release |

The single workflow has two jobs: `build-mac` uploads the DMG/ZIP artifacts,
then `release` downloads them and creates a GitHub Release from the tag.

## Security & Confidentiality

- **GitHub repo is private** — source not publicly visible
- **No telemetry** — no analytics, no external API calls, no data leaves the browser/machine at runtime
- **Fully offline** — all libraries and fonts live in `libs/`; no CDN calls at runtime
- **Security headers** — Cloudflare Pages deployment sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` via `_headers`

## Tool-Specific Notes

### TimeCast (`timecast.html`)
- Tracks project phases as column headers on the Gantt
- Supports baseline vs. current schedule comparison
- Phase data is the primary sync source for ResourceCast
- **Dynamic scale selector** (Phase 27): Monthly / Weekly / Quarterly. Stored as `viewScale` in `chartState` and `collectState`. Weekly columns are 26px-min aligned to Monday boundaries; quarterly columns are 60px-min with Q0–Q3 labels.
  - `buildUnits(sm, sy, em, ey, scale)` — replaces `buildMonths()` for rendering
  - `unitColOf(units, m, y, scale)` — replaces `colOf()` for column index lookup
  - `todayUnitIdx(units, scale)` — today's column index across any scale
  - Drag interactions (`_ganttDragStart`, `_ganttDragMove`, `_refreshTaskBars`) all scale-aware via `_gDrag.scale` and `_gDrag.months`

### ResourceCast (`resourcecast.html`)
- Monthly hours grid — rows are roles, columns are months
- FTE calculation: `monthly hours / available hours per month`
- Cost: `hours × rate × hedge multiplier`
- Supports multi-currency rates with a hedge rate factor
- Has a full Resource Gantt chart in addition to the grid
- Excel import maps column headers to role names

### OrgCast (`orgcast.html`)
- Renders SVG connector lines between org chart nodes
- Supports vacancy placeholders
- **Format selector**: A4 Landscape / A4 Portrait / A3 Landscape via `<select id="format-select">` → `changeFormat()` → `setFormat(fmt)`. Format stored as `currentFormat` global (normalised to `'a4-landscape'`/`'a4-portrait'`/`'a3-landscape'`); legacy values `'A4'`/`'A3'`/`'screen'` are remapped on load.
- **Portrait layout**: `layoutNodePortrait()` stacks nodes vertically (depth = column, row = y); uses L-shaped connectors (parent right-center → busX → child left-center). `subtreeHeight()` is the vertical counterpart of `subtreeWidth()`.
- **Landscape layout**: `layoutNode()` spreads nodes horizontally (depth = row); uses bus-bar connectors (parent bottom → busY → child top).
- **`autoScale(contentW, contentH)`**: portrait scales by HEIGHT (257 mm usable, `transformOrigin: 'top left'`); landscape modes scale by WIDTH (`top center`).
- **Export PNG**: `exportPNG()` captures `#output` (full page: title + chart + legend) via `html2canvas` at scale:2. Filename derived from `SuiteManager` project name. `libs/html2canvas.min.js` loaded separately in `<head>`.
- **Company field**: free-text `<input type="text" class="p-company">` — accepts any string (JV partner, subcontractor, etc.). Legacy key values (`'ourco'`, `'client'`, etc.) are resolved to display labels via `compLabel()` when loading old saves. `compColor()` matches by key first, then by label, then returns `#6b6860` fallback.

### RFQCast (`rfqcast.html`)
- Validity expiration is computed dynamically from `Date.now()`
- Equipment types are user-configurable categories for suppliers
- Item rows have an animated SVG chevron `.expand-btn` that rotates 180° via `.open` class; `toggleDetail()` manages the toggle
- Row click calls `toggleDetail()` unless the click target is a `select`, `input`, or `button` (other than `.expand-btn`, which has its own dedicated listener with `stopPropagation`)
- **Push to CalcCast**: `pushToCalcCast()` reads winning vendor quotes and upserts them into `bidcast_state_calccast` via `rfqId` matching to prevent duplication
- `.btn-green` class used for the Push to CalcCast action button

### DORCast (`dorcast.html`)
- Has a preset modal to load standard responsibility templates
- Supports multiple parties (columns) with free-form naming

### LetterCast (`lettercast.html`)
- Generates formal commercial cover letters / offer documents with logos, addressee block, subject line, and dynamic free-text sections
- Supports two logos: company (left) and customer (right), both stored in `localStorage` and shared with other tools
- Dynamic sections list: users add/remove/reorder titled text blocks that appear in the output document
- Default sections loaded on first run: Scope of Supply, Assumptions & Deviations, Terms & Conditions
- Project name is synced from `bidcast_suite_sync.projectName` on load and via `SuiteManager.onUpdate`
- PDF export uses `window.print()` rather than html2pdf.js (output is a print-optimised A4 sheet)
- State key: `bidcast_state_lettercast`

### RiskCast (`riskcast.html`)
- Risk register with 5×5 scoring matrix (likelihood × impact)
- Each row has: Type (risk/opportunity), Category, Topic, Cause, Risk Description, Impact Description, Likelihood (1-5), Impact (1-5), Score (auto), Mitigation Plan, Status
- Opportunities always render green badge ("Gain") regardless of score
- Score badges: ≤4 green, ≤9 amber, ≤14 orange, ≥15 red
- Summary pills count by severity; opportunity rows always count as "gain"
- Excel export columns: `#, Type, Category, Topic, Cause, Risk Description, Impact Description, Likelihood, Impact (I), Score, Level, Mitigation Plan, Status`

### CashFlow (`cashflow.html`)
- Monthly cash-flow simulator for a bid project; reads live data from CalcCast (`bidcast_state_calccast`) and TimeCast (`bidcast_state_timecast`)
- State key: `bidcast_state_cashflow` — persisted via `saveState()` / `loadState()`
- **`_simState`** (persisted): `{ milestones[], dcCurve, fcCurve, itemDist: {} }` — user inputs only
- **`_simData`** (derived, not persisted): loaded fresh from suite each time via `loadSuiteData()`; contains `costItems[]` — CalcCast rows aggregated by category using a `Map` (category name is the stable item ID)
- **Per-item cost distribution**: `distributeItem(itemId, total, N)` — looks up `_simState.itemDist[itemId]`; dispatches to `distributeCost()` (linear/front-loaded/back-loaded/bell) or applies user-defined milestone array. Falls back to global `dcCurve` if no config exists for that item.
- **Cancellation curve**: `arrCancPenalty[i] = cumDC` — derived automatically from per-item cost schedules; no separate Cancellation Terms inputs
- **Three Chart.js charts**: main cashflow bars (`chartInst`), forecast (`chartInst2`), per-item cost breakdown stacked bar (`chartInst3`, `#breakdownChart`)
- `ITEM_COLORS` — 15-colour palette cycling for breakdown chart
- `renderItemDist()` — builds Item Cost Schedules section in the editor; uses `esc(JSON.stringify(item.id))` pattern for safe inline `onchange` handlers when item IDs contain spaces or special chars
- `_ensureItemDist(id)` — lazy-initialises an item's distribution config to `{ type:'linear' }` on first access

### W2W Report (`w2w-report.html`)
- Wall-to-Wall (LoA) financial report; reads CalcCast data from `bidcast_state_calccast`
- State key: `bidcast_state_w2w` — persisted via `saveW2WState()` / `loadW2WState()`
- **Two KPI tiers**:
  1. **Project-level** (selling unit): Specified Risk %, Unspecified Risk %, SG&A %, HQ Adders EXU %, HQ Adders BA %, EBIT %, Negotiation %, Warranty % — used in the main overview tab
  2. **Factory-level**: exactly 5 KPIs per factory — `rw` (Risk+Warranty combined), `sga`, `exu`, `ba`, `ebit` — stored in `_w2wState.factories[].kpis`
- **`_computeFactory(dc, kpis)`**: sequential markup: `dc → afterRisk → afterSGA → afterEXU → afterBA → transfer`. Returns `{ dc, afterRisk, afterSGA, afterEXU, afterBA, transfer, riskProv, sgaProv, exuProv, baProv, ebitProv, salesMargin, funcCost, profit }`
- **`renderW2WTable()`**: consolidated table with one column per factory + Business Area Summary. `%` column for each provision row divides by its own markup base (not revenue) so values match the entered KPI exactly:
  - Risk+Warranty %: `riskProv / dc`
  - SG&A %: `sgaProv / afterRisk`
  - HQ Adders-EXU %: `exuProv / afterSGA`
  - HQ Adders-BA %: `baProv / afterEXU`
  - EBIT %: `ebitProv / afterBA`
- `row()` helper in `renderW2WTable()` accepts optional `baseFn` to override the % denominator for provision rows
- **Fixed vs Estimated split**: CalcCast rows carry `estFix` field (`"Fixed"` or `"Estimated"`); `aggregateDirectCost()` accumulates `fixedDC` / `estimatedDC`; a doughnut chart (`scopeChartInst`, `#scopePieChart`) renders in the Project Scope tab
- `_byCategory` — object keyed by CalcCast category name → total EUR value; drives factory DC lookup
- Dark mode supported via `[data-theme="dark"]` on `<html>`
- External dependency: Chart.js (local `libs/chart.js`)

### ForeCast (`forecast.html`)
- Pipeline and overlap monitor; primary input is a Salesforce report exported as Excel
- Handles real-world Salesforce export quirks: metadata rows, visual grouping headers (quarter label appears once, all rows beneath inherit it), sort-arrow suffixes on column headers, EU/US number formatting, merged cells producing sparse arrays, formatted percentage strings
- Per-quarter overlap analysis, Bid Manager workload cards, dynamic filters
- State key: `bidcast_state_forecast`

### BidScore (`bidscore.html`)
- Bid / No-Bid decision tool with a configurable set of weighted scoring criteria
- Live verdict gauge: score ≥ 65 → **BID** (green), ≥ 40 → **CONDITIONAL** (amber), < 40 → **NO BID** (red)
- Weighted score = Σ(weight × score) / Σ(weight × 5) × 100
- State key: `bidcast_state_bidscore`
- Data consumed by BidPack `_renderBidScore()` and `exportPPTX()`

### ActionLog (`actionlog.html`)
- Bid action tracker with category, action description, owner, due date, priority (High / Medium / Low), and status (Open / In Progress / Done / Blocked)
- Overdue actions (status ≠ Done, due date in the past) are highlighted in the output
- State key: `bidcast_state_actionlog`
- Data consumed by BidPack `_renderActions()` and `exportPPTX()`

### BidPack (`bidpack.html`)
- Bid package assembler — pulls live data from all seven source tools (BidScore, TimeCast, CalcCast, ResourceCast, RiskCast, RFQCast, ActionLog) into a single document
- Sections are user-orderable via drag-and-drop and individually togglable; order/state persisted under `bidcast_state_bidpack`
- **Export formats**: PDF (via `window.print()`), standalone HTML (self-contained snapshot with embedded state), and native PowerPoint (`.pptx`) via PptxGenJS
- **`exportPPTX()`**: generates a 16:9 widescreen presentation using `PptxGenJS`; cover slide, TOC slide, then one content slide per enabled section. Each section reads from the same localStorage key as its HTML renderer. Requires `libs/pptxgen.bundle.js`.
- `_hasData(id)` — checks whether the source tool's localStorage key contains renderable data; drives the `✓ Data` / `No data` badge on each section row
- Section renderers (`_renderBidScore`, `_renderTimeline`, `_renderCommercial`, `_renderResources`, `_renderRisks`, `_renderSuppliers`, `_renderActions`) — read from localStorage and return HTML strings for the assembled document
- State key: `bidcast_state_bidpack`

### CVCast (`cvcast.html`)
- Curriculum vitae / résumé generator producing a two-column A4 PDF-ready layout
- State key: `bidcast_state_cvcast` — persisted via standard `collectState()` / `applyState()`
- **Dark mode**: toggled via `toggleTheme()` / `_applyTheme()`; preference stored in `localStorage['bidcast_theme']`
- **Two-column layout**: left sidebar (photo, contact, skills, languages) + right main area (summary, experience, education)
- Experience rows support `title`, `company`, `period`, and multi-line `description`
- Language rows support a proficiency level (Native / Fluent / Professional / Basic) rendered as a fill bar via `langPct()`
- Skills stored as a single comma-separated input
- PDF export uses `html2pdf.js`; filename derived from `state.name`

## Function Index by File

Shared functions present in every tool (not repeated below):
- `saveLogo()` / `clearLogo()` / `updateLogoUI()` — logo persistence
- `collectState()` / `applyState()` — state serialization
- `saveJSON()` / `loadJSON()` / `exportHTML()` — file I/O
- `exportPDF()` — PDF via html2pdf.js
- `setFormat()` — print page size toggle
- `goBack()` — switch output → editor
- `_snapshot()` / `_scheduleSnap()` / `undo()` / `redo()` / `_syncUndoUI()` — undo/redo
- `suiteWrite()` / `suiteRead()` / `_updateSyncBadge()` — suite sync
- `SuiteManager.migrate()` — one-time migration of legacy `pyl0n_` localStorage keys to `bidcast_`

### timecast.html

| Function | Description |
|----------|-------------|
| `monthOpts()` | Generates HTML option elements for month select dropdowns |
| `syncTitleFromProject()` | Auto-updates chart title from single project name unless manually edited |
| `addTask()` | Creates a new task/milestone row with drag-handle, inputs, and optional baseline row |
| `removeTaskRow()` | Removes task row and its associated baseline row from DOM |
| `toggleBaseline()` | Shows/hides baseline schedule row for a task |
| `getRows()` | Extracts all task data from a tbody (name, dates, color, notes, baseline) |
| `initDragRow()` | Attaches HTML5 drag-and-drop event listeners to task row |
| `sameBody()` | Checks if two elements belong to the same tbody |
| `addProject()` | Creates a new project card with bid/execution phase sections (max 3) |
| `onProjNameChange()` | Triggers title sync when project name changes |
| `removeProject()` | Removes project card and updates project list |
| `updateProjColor()` | Changes project card border and color dot to selected color |
| `onProjCountChange()` | Adjusts number of projects up/down to match input value |
| `updateProjWarn()` | Shows warning when 4+ projects selected with non-A2 format |
| `updateDelBtns()` | Disables delete buttons when only one project remains |
| `updateAddProjBtn()` | Updates project count input and UI state |
| `buildMonths()` | Generates array of `{m, y}` objects for a date range (monthly only) |
| `_buildWeekUnits()` | Generates weekly unit array aligned to Monday boundaries |
| `_buildQuarterUnits()` | Generates quarterly unit array (Q0–Q3 per year) |
| `buildUnits()` | Dispatcher — returns correct unit array for the given scale |
| `unitColOf()` | Maps a task month/year to a column index for any scale |
| `todayUnitIdx()` | Returns today's column index in a units array |
| `yearBands()` | Groups consecutive months by year into band objects |
| `el()` | Factory function to create DOM elements with optional class and HTML |
| `colOf()` | Finds index of a month in a monthly array (legacy, still used internally) |
| `buildSidebar()` | Renders draggable task list sidebar for chart generation |
| `sameSbLane()` | Checks if sidebar items are in same lane (Bid/Execution) |
| `getLaneTasks()` | Fetches tasks for a project/lane combination from state |
| `generate()` | Collects form data, reads `#view-scale`, sets `viewScale` global, renders Gantt |
| `refreshChart()` | Re-renders chart preserving current state |
| `renderChart()` | Builds CSS-grid Gantt with timeline, tasks, baseline, today marker; scale-aware |
| `renderGroup()` | Renders individual task group (bars, milestones) in chart |
| `_refreshTaskBars()` | Live re-draws bar cells for one task row during drag; uses `buildUnits`/`unitColOf` |
| `_ganttDragStart()` | Initiates drag — caches `units` and `scale` in `_gDrag` |
| `_ganttDragMove()` | Updates task dates during drag using `unitColOf` and `.firstMonth`/`.firstYear` |
| `_ganttDragEnd()` | Finalises drag, syncs dates back to editor |
| `_colFromMouseX()` | Maps mouse X position to a column index in the current units array |
| `togglePhase()` | Collapses/expands bid or execution phase section |

### resourcecast.html

| Function | Description |
|----------|-------------|
| `loadSETemplate()` | Replaces all roles with 17-role SE standard template |
| `esc()` | HTML-escapes string for safe DOM insertion |
| `fmtN()` | Formats number with locale and optional decimal places |
| `fmtEUR()` | Formats number as EUR currency |
| `fmtDKK()` | Formats number as DKK currency |
| `hedgeRate()` | Gets current exchange rate from input or default 7.46 |
| `togglePhase()` | Collapses/aggregates monthly hours into phase totals or expands |
| `_buildCols()` | Generates month and phase-aggregate column definitions |
| `_getRowMonthHours()` | Extracts monthly hours map from a role row's inputs |
| `addPhase()` | Creates draggable phase chip with name input and drag handlers |
| `removePhase()` | Deletes phase chip and rebuilds monthly grid |
| `getPhases()` | Extracts all phase data from chips (id, name, date range) |
| `rebuildMonthlyGrid()` | Regenerates role grid columns based on current phases |
| `addRole()` | Creates role row with name, rate, monthly hour cells, and totals |
| `removeRole()` | Deletes role row and recalculates totals |
| `updateMonthlyTotals()` | Recalculates monthly and total hours/costs across all roles |
| `addExpense()` | Creates expense row with label and amount fields |
| `updateExpTotals()` | Recalculates expense totals and grand total cost |
| `getRoleData()` | Extracts all role data with calculated hours and costs |
| `generate()` | Collects state and renders output grid and Gantt chart |
| `_buildMonths()` | Generates month array from start/end dates |
| `_yearBands()` | Groups months by year for header spanning |
| `renderGantt()` | Renders resource Gantt chart (calendar or phase view) |
| `_renderCalendarGantt()` | Builds calendar-style Gantt with month columns |
| `_renderPhaseGantt()` | Builds phase-aggregated Gantt view |
| `importExcel()` | Parses Excel file and maps columns to roles |
| `_parseMonthStr()` | Extracts month/year from "Jan 2025" format strings |
| `exportExcel()` | Generates Excel workbook with role grid and cost summary |
| `_syncRoleKey()` | Derives sync role key from title for OrgCast sync |

### orgcast.html

| Function | Description |
|----------|-------------|
| `toggleCompact()` | Toggles compact/expanded layout mode for org chart |
| `roleLabel()` / `roleColor()` | Look up display label/color for a role key |
| `compLabel(key)` | Resolves legacy company key to display label (or returns key unchanged for free text) |
| `compColor(str)` | Returns color for company string: matches by key, then by label, then `#6b6860` fallback |
| `roleOpts()` | Generates HTML option elements for role select |
| `addPerson()` | Creates team member row with role, title, free-text company input, parent dropdown |
| `refreshParentDropdowns()` | Updates parent person dropdown in all rows |
| `getPeople()` | Extracts all person data from table rows |
| `initDrag()` | Attaches HTML5 drag-and-drop listeners to person row |
| `buildTree()` | Constructs parent-child tree structure from flat person array |
| `subtreeWidth()` | Recursively calculates horizontal node-columns needed (landscape layout) |
| `subtreeHeight()` | Recursively calculates vertical node-rows consumed (portrait layout) |
| `layoutNode()` | Assigns x, y positions for landscape layout (depth = row, spread horizontally) |
| `layoutNodePortrait()` | Assigns x, y positions for portrait layout (depth = column, stacked vertically) |
| `renderChart()` | Branches on `currentFormat`: portrait uses `layoutNodePortrait` + L-shaped connectors; landscape uses `layoutNode` + bus-bar connectors |
| `autoScale(contentW, contentH)` | Portrait: scales by HEIGHT (`top left`); landscape: scales by WIDTH (`top center`) |
| `changeFormat()` | Reads format select, calls `setFormat()`, re-generates chart if output is visible |
| `setFormat(fmt)` | Normalises legacy format strings, sets `currentFormat`, updates CSS class and `@page` size |
| `exportPNG()` | Captures `#output` via `html2canvas` scale:2, downloads as `OrgChart_<projectName>.png` |
| `generate()` | Collects state and renders org chart output |
| `setParentByRole()` | Sets parent-child relationship by matching role keys |

### rfqcast.html

| Function | Description |
|----------|-------------|
| `addEquipType()` | Creates equipment type section with vendor list and strategy notes |
| `removeEquipType()` | Deletes equipment type section and syncs dropdowns |
| `updateEtColor()` | Changes equipment type section background color |
| `getEquipTypes()` | Extracts all equipment type data from DOM |
| `syncTypeDropdowns()` | Updates item type select options from current equipment types |
| `vendorStatus()` | Returns status label for a vendor |
| `statusClass()` / `statusLabel()` | Returns CSS class / readable label for a status code |
| `validityWarn()` | Checks if vendor quote validity has expired |
| `addItem()` | Creates RFQ item row with type, description, qty, and vendor detail row |
| `buildDetailPanel()` | Renders detailed fields for an item (tech resp., procurement strategy, vendors) |
| `buildVendorBlock()` | Creates vendor input block (NDA, enquiry/offer dates, etc.) |
| `getVendorsFromPanel()` | Extracts vendor data from detail panel inputs |
| `saveDetailToRow()` | Persists detail panel data to item row data attributes |
| `updateVendorPills()` | Renders vendor status pills for item row |
| `toggleDetail()` | Shows/hides detail panel for an item |
| `deleteRow()` | Removes item and its detail row |
| `initDrag()` | Attaches HTML5 drag-and-drop listeners to item row |
| `getItems()` | Extracts all item data from table |
| `generate()` | Collects state and renders procurement dashboard output |
| `renderTypeTable()` | Renders item rows grouped by equipment type |
| `loadPreset()` | Loads preset equipment types and suppliers |
| `importExcel()` | Parses Excel file and loads items/equipment types |
| `exportExcel()` | Generates Excel workbook with full RFQ data |
| `esc()` | HTML-escapes string for safe DOM insertion |

### dorcast.html

| Function | Description |
|----------|-------------|
| `addParty()` | Creates party/column chip with color picker and name input |
| `getParties()` | Extracts all party data from chips (id, name, color) |
| `rebuildTableHead()` | Regenerates table header with party columns and syncs mark cells |
| `syncMarkCells()` | Creates DORI marker cells for a row across all parties |
| `cycleVal()` | Cycles cell value through D → O → R → S → I → blank |
| `insertRowAfter()` | Inserts a new row after a reference row |
| `addRow()` | Creates DOR matrix data row with item inputs |
| `addRowAt()` | Creates section/header row or reorders existing rows |
| `deleteRow()` | Removes a row from the matrix |
| `createInsertRow()` | Creates temporary insert-after row UI |
| `esc()` | HTML-escapes string for safe DOM insertion |
| `initRowDrag()` | Attaches HTML5 drag-and-drop listeners to matrix row |
| `getRows()` | Extracts all row data (type, item, markers by party) |
| `generate()` | Collects state and renders responsibility matrix output |
| `openModal()` / `closeModal()` | Shows/hides preset template modal |
| `loadPreset()` | Loads a responsibility template into the matrix |
| `importExcel()` | Parses Excel file and loads rows/parties |
| `exportExcel()` | Generates Excel workbook with matrix data |

### lettercast.html

| Function | Description |
|----------|-------------|
| `addSection(data)` | Creates a titled text section block with title input and content textarea |
| `removeSection(btn)` | Deletes a section block and triggers autoSave |
| `getSections()` | Extracts all section data `{title, content}` from DOM |
| `addDefaultSections()` | Inserts the three default sections (Scope, Assumptions, T&C) on first load |
| `uploadLogo(side, input)` | Reads image file and stores as base64 in `bidcast_logo` (co) or `bidcast_customer_logo` (cx) |
| `clearLogo(side)` | Removes logo from localStorage and hides preview |
| `loadLogos()` | Reads both logos from localStorage and populates preview elements |
| `onProjName()` | Writes project name change to suite sync |
| `generate()` | Renders the output document (logos, addressee, subject, intro, sections) and switches to output view |
| `goBack()` | Switches back from output view to editor |
| `exportPDF()` | Calls `generate()` then `window.print()` for A4 print-to-PDF |
| `collectState()` / `applyState()` | Standard state serialization; stored under `bidcast_state_lettercast` |
| `autoSave()` | Debounces to `_scheduleSnap()` which writes to localStorage via `_snapshot()` |
| `saveJSON()` | Downloads state as `.json` and writes a timed backup |
| `loadJSON(input)` | Parses uploaded `.json` and calls `applyState()` |
| `_writeBackup()` | Saves a timestamped backup to localStorage; prunes to last 5 |
| `_showBackups()` | Shows a popover listing restorable backups |

### calccast.html

Each cost row includes an `estFix` field (`"Fixed"` or `"Estimated"`) indicating the pricing type. This field is consumed by `w2w-report.html` to split the direct cost into fixed vs estimated for the doughnut chart.

| Function | Description |
|----------|-------------|
| `addCostRow(data)` | Creates a cost breakdown row with category, description, scope, supplier, units, qty, unit price, currency, `estFix` (Fixed/Estimated) |
| `removeCostRow(btn)` | Deletes a cost row and recalculates totals |
| `_collectCostRows()` | Extracts all cost row data; reads `rfqId` via explicit null guard to prevent duplication on RFQCast push |
| `calcTotals()` | Recalculates subtotals and grand total across all cost rows |
| `generate()` | Collects state and renders cost summary output |
| `collectState()` / `applyState()` | Standard state serialization; stored under `bidcast_state_calccast` |

### riskcast.html

| Function | Description |
|----------|-------------|
| `addRisk()` | Creates risk row with type, category, topic, cause, descriptions, scoring inputs, mitigation, status |
| `removeRisk()` | Deletes risk row and updates summary pills |
| `_getRisks()` | Extracts all risk data: `{type, category, topic, cause, desc, impactDesc, likelihood, impact, score, mitigation, status}` |
| `_refreshScore()` | Recalculates score badge color/label for a row; opportunities always render green "Gain" |
| `_refreshSummaryPills()` | Updates count pills (Critical / High / Medium / Low / Gain) in the editor |
| `generate()` | Collects state and renders risk register output table |
| `importExcel()` | Parses Excel file and loads risk rows |
| `exportExcel()` | Generates Excel workbook; columns: `#, Type, Category, Topic, Cause, Risk Description, Impact Description, Likelihood, Impact (I), Score, Level, Mitigation Plan, Status` |
| `esc()` | HTML-escapes string for safe DOM insertion |

### cashflow.html

| Function | Description |
|----------|-------------|
| `loadSuiteData()` | Reads CalcCast + TimeCast state; aggregates cost rows by category into `_simData.costItems[]` via `Map` |
| `saveState()` / `loadState()` | Persist/restore `_simState` to `bidcast_state_cashflow`; `loadState()` also syncs HTML inputs |
| `simulate()` | Runs monthly simulation; sums per-item `distributeItem()` arrays for DC; sets `arrCancPenalty[i] = cumDC` |
| `distributeItem(itemId, total, N)` | Returns monthly cost array for one item; dispatches to `distributeCost()` or milestone interpolation |
| `distributeCost(type, total, N)` | Spreads total over N months using linear / front-loaded / back-loaded / bell curve profiles |
| `renderItemDist()` | Builds Item Cost Schedules section in editor; uses `esc(JSON.stringify(id))` for safe inline handlers |
| `updateItemDist(jid, key, val)` | Updates a field in `_simState.itemDist[id]` and re-simulates |
| `addItemMilestone(jid)` | Appends a new milestone row to an item's distribution config |
| `removeItemMilestone(jid, idx)` | Removes a milestone row by index |
| `updateItemMilestone(jid, idx, field, val)` | Updates milestone month or percent value |
| `_ensureItemDist(id)` | Lazy-initialises item dist config to `{ type:'linear' }` if not yet set |
| `updateCharts()` | Rebuilds all three Chart.js charts with latest simulation data |
| `ITEM_COLORS` | 15-colour array cycling for the per-item breakdown stacked bar chart |

### w2w-report.html

| Function | Description |
|----------|-------------|
| `loadCalcCastData()` | Reads `bidcast_state_calccast`; calls `aggregateDirectCost()`, populates `_directCost`, `_byCategory`, `_fixedDC`, `_estimatedDC` |
| `aggregateDirectCost(s)` | Iterates CalcCast rows; converts currencies via FX rates; accumulates per-category totals and fixed/estimated split |
| `computeKpis(dc, risk, sga, exu, ba, ebit, neg)` | Project-level sequential markup computation for the selling unit overview |
| `_computeFactory(dc, kpis)` | Factory-level sequential markup: `dc → afterRisk → afterSGA → afterEXU → afterBA → transfer` using 5 KPIs (`rw`, `sga`, `exu`, `ba`, `ebit`) |
| `addFactory()` | Pushes a new factory entry with default KPIs `{ rw:5, sga:4, exu:3, ba:2, ebit:8 }` to `_w2wState.factories` |
| `removeFactory(id)` | Removes a factory entry by id |
| `updateFactoryKpi(id, key, val)` | Updates a single KPI on a factory, saves state, refreshes stack and table |
| `renderFactories()` | Renders factory cards with 5 KPI inputs and step-by-step value stack; calls `renderW2WTable()` |
| `_refreshFactoryStack(id)` | Re-renders the value stack for one factory card without rebuilding all cards |
| `_factoryStackHTML(r)` | Generates the HTML for the stepped value display (Base DC → transfer price) |
| `renderW2WTable()` | Builds consolidated W2W table; provision `%` divides by its own markup base via `baseFn` option on `row()` |
| `renderScope()` | Renders Project Scope tab with category cost table and Fixed vs Estimated doughnut chart |
| `updateAll()` | Recalculates project-level KPIs and updates all overview cards |
| `saveW2WState()` / `loadW2WState()` | Persist/restore `_w2wState` to `bidcast_state_w2w` |
| `updateFactoryKpi()` | Also calls `renderW2WTable()` so the consolidated table stays in sync with card edits |

### cvcast.html

| Function | Description |
|----------|-------------|
| `esc(s)` | HTML-escapes string for safe DOM insertion |
| `gv(id)` / `sv(id, v)` | Get/set value of an element by ID |
| `addExperience(data)` | Creates an experience row with title, company, period, and description inputs |
| `getExperiences()` | Extracts all experience data from DOM rows |
| `langPct(level)` | Maps proficiency level string to a percentage fill for the language bar |
| `addLanguage(data)` | Creates a language row with name and proficiency level select |
| `getLanguages()` | Extracts all language data from DOM rows |
| `generate()` | Renders the two-column CV output (sidebar + main area) and switches to output view |
| `goBack()` | Switches back from output view to editor |
| `exportPDF()` | Exports rendered CV as A4 PDF via html2pdf.js; filename derived from `state.name` |
| `collectState()` / `applyState()` | Standard state serialization; stored under `bidcast_state_cvcast` |
| `autoSave()` | Debounces to `_scheduleSnap()` for live auto-save |
| `saveJSON()` / `loadJSON(input)` | Download/restore state as `.json` |
| `exportHTML()` | Creates a fully self-contained HTML snapshot with state embedded |
| `_snapshot()` / `_scheduleSnap()` / `undo()` / `redo()` / `_syncUndoUI()` | Undo/redo stack |
| `toggleTheme()` | Cycles between light and dark mode |
| `_applyTheme(theme)` | Applies theme class to `<html>` and persists to `bidcast_theme` |

### bidpack.html

| Function | Description |
|----------|-------------|
| `_hasData(id)` | Checks localStorage for a section's source tool data; returns `true` if renderable content exists |
| `_buildSecRow(sec)` | Creates a draggable section list row with checkbox, title, description, and data badge |
| `renderSectionList(sections)` | Renders the ordered section list in `#section-list` |
| `toggleSection(id, enabled)` | Enables/disables a section by id and saves state |
| `collectState()` / `applyState()` | Standard state serialization; stored under `bidcast_state_bidpack` |
| `saveJSON()` / `loadJSON(input)` | Download/restore state as `.json` |
| `_renderCover(st)` | Renders the cover page with logo, project name, customer, revision, date, preparer, confidentiality |
| `_renderToc(enabledSecs, projName)` | Renders the Table of Contents page |
| `_renderBidScore(sec, num, proj)` | Renders Executive Summary section from `bidcast_state_bidscore` |
| `_renderTimeline(sec, num, proj)` | Renders Project Timeline section from `bidcast_state_timecast` |
| `_renderCommercial(sec, num, proj)` | Renders Commercial Breakdown section from `bidcast_state_calccast` |
| `_renderResources(sec, num, proj)` | Renders Resource Plan section from `bidcast_state_resourcecast` |
| `_renderRisks(sec, num, proj)` | Renders Risk Register section from `bidcast_state_riskcast` |
| `_renderSuppliers(sec, num, proj)` | Renders Supplier Quotes section from `bidcast_state_rfqcast` |
| `_renderActions(sec, num, proj)` | Renders Action Items section from `bidcast_state_actionlog` |
| `_noDataPage(sec, num, source, proj)` | Renders a placeholder page when a section has no source data |
| `generate()` | Assembles all enabled sections into `#doc-wrap` and switches to output view |
| `goBack()` | Returns from output view to editor |
| `exportPDF()` | Calls `generate()` then `window.print()` for print-to-PDF |
| `exportHTML()` | Creates a fully self-contained HTML snapshot with embedded state |
| `exportPPTX()` | Generates a native `.pptx` presentation via PptxGenJS; cover + TOC + one slide per enabled section |
