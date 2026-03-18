# CLAUDE.md — PYL0N Suite (forecast.bid)

This file documents the codebase structure, conventions, and workflows for AI assistants working on this project.

## Project Overview

**PYL0N** is a self-contained, zero-installation web application suite for bid and project teams. It runs entirely in the browser — no server, no build step, no backend. The suite consists of seven specialized planning tools plus a landing page.

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
| `favicon.svg` | — | Brand favicon |
| `logo.svg` | — | Brand logo (34×34px grid) |

## Architecture

### No Build System

This project has no `package.json`, no npm, no bundler, no TypeScript. Every file is a standalone HTML page that runs directly in a browser. Do not introduce build tools unless explicitly requested.

### Monolithic HTML Files

Each tool lives entirely within a single `.html` file:
- `<style>` blocks contain all CSS (no external stylesheets)
- `<script>` blocks contain all JavaScript (no external JS files)
- HTML markup, styles, and logic are co-located per tool

### External Dependencies (CDN only)

No local node_modules. Libraries are loaded from CDN:
- **XLSX** `v0.18.5` or `v0.20.3` — Excel import/export via `cdnjs.cloudflare.com`
- **html2pdf.js** `v0.10.1` — PDF generation via `cdnjs.cloudflare.com`
- **Google Fonts** — DM Sans, DM Mono typefaces

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
1. `<!DOCTYPE html>` + `<head>` with CDN links and Google Fonts
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

### Running Locally

No installation required. Open any `.html` file directly in a browser:
```
open timecast.html
# or
python3 -m http.server 8080  # then visit http://localhost:8080
```

### Making Changes

1. Edit the relevant `.html` file directly
2. Reload the browser to test
3. All CSS and JS is inline — no compilation step
4. Test export formats (PDF, Excel, JSON, HTML) after logic changes

### Git Workflow

- Main branch: `master`
- Feature branches follow the convention: `claude/<description>-<id>`
- Commit messages use conventional commits format: `feat(tool):`, `fix(tool):`, `refactor:`, etc.
- Commits are signed with SSH key (`/home/claude/.ssh/commit_signing_key.pub`)

### What NOT to Do

- Do not introduce a build system (webpack, vite, esbuild) unless explicitly requested
- Do not add TypeScript — the project is intentionally vanilla JS
- Do not create separate `.css` or `.js` files — keep styles and scripts inline in each HTML file
- Do not add a backend or server component unless explicitly requested
- Do not use `npm install` or create `package.json`
- Do not add testing frameworks without explicit request
- Do not use `localStorage` keys outside the `bidcast_` prefix namespace

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
- Exports at A4 and A3 print formats

### RFQCast (`rfqcast.html`)
- Validity expiration is computed dynamically from `Date.now()`
- Equipment types are user-configurable categories for suppliers

### DORCast (`dorcast.html`)
- Has a preset modal to load standard responsibility templates
- Supports multiple parties (columns) with free-form naming

### RiskCast (`riskcast.html`)
- Risk register with 5×5 scoring matrix (likelihood × impact)
- Each row has: Type (risk/opportunity), Category, Topic, Cause, Risk Description, Impact Description, Likelihood (1-5), Impact (1-5), Score (auto), Mitigation Plan, Status
- Opportunities always render green badge ("Gain") regardless of score
- Score badges: ≤4 green, ≤9 amber, ≤14 orange, ≥15 red
- Summary pills count by severity; opportunity rows always count as "gain"
- Excel export columns: `#, Type, Category, Topic, Cause, Risk Description, Impact Description, Likelihood, Impact (I), Score, Level, Mitigation Plan, Status`

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
| `compLabel()` / `compColor()` | Look up display label/color for a company key |
| `roleOpts()` / `compOpts()` | Generate HTML option elements for role/company selects |
| `addPerson()` | Creates team member row with role, title, company, parent dropdown |
| `refreshParentDropdowns()` | Updates parent person dropdown in all rows |
| `getPeople()` | Extracts all person data from table rows |
| `initDrag()` | Attaches HTML5 drag-and-drop listeners to person row |
| `buildTree()` | Constructs parent-child tree structure from flat person array |
| `subtreeWidth()` | Recursively calculates node width needed for layout |
| `layoutNode()` | Assigns x, y positions recursively for tree nodes |
| `renderChart()` | Builds SVG org chart with nodes and connector lines |
| `autoScale()` | Adjusts SVG zoom/pan to fit content in viewport |
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
