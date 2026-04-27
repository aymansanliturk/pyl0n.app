# PYL0N Suite — Enterprise Bid & Project Planning

**Self-contained. Zero-installation. 100% local. Built for the enterprise.**

PYL0N is a fully integrated bid and project planning suite that runs entirely in the browser — no server, no backend, no IT provisioning required. It ships as 12 monolithic HTML tools plus a landing dashboard, and can also be packaged as a signed macOS desktop app via Electron. Every module shares a common design language, a unified state engine, and seamless cross-tool data sync.

---

## Why PYL0N? — The Case for IT

### 1. Zero Infrastructure, Zero Risk

Enterprise planning tools typically require server provisioning, database administration, license servers, VPN access, and ongoing patching. PYL0N eliminates all of it. Every tool is a single `.html` file that opens directly in any modern browser. There is no install package, no admin rights required, no dependency on internal network connectivity, and no backend surface to attack or maintain. All user data is stored exclusively in the browser's `localStorage` under a namespaced prefix — it never leaves the machine. For IT teams managing sprawling infrastructure stacks, PYL0N is the rare ask that adds zero new obligations.

### 2. Enterprise Security by Architecture, Not by Policy

Most web applications enforce security through access controls, firewalls, and audit logs — all of which require active management and can fail. PYL0N enforces security at the architecture level: there is no server to breach, no API to intercept, no credentials to steal. Sensitive bid data — pricing, margins, org structures, supplier quotes — stays locked on the device that created it. When deployed via Cloudflare Pages, the suite enforces `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` headers automatically. Teams dealing with NDAs, embargo periods, or competitive sensitivity get a planning environment that is structurally confidential, not just procedurally so. The Salesforce Excel importer, for example, parses CRM data entirely client-side using the bundled XLSX library — your pipeline figures are never transmitted anywhere.

### 3. A Fully Integrated Toolchain, Not a Collection of Spreadsheets

PYL0N is not a folder of disconnected templates. The 12 tools form a live, synced pipeline. Phase timelines built in **TimeCast** automatically propagate into the resource allocation columns of **ResourceCast**, which in turn populates the team structure in **OrgCast**. Winning supplier quotes accepted in **RFQCast** push directly into the cost breakdown in **CalcCast**, which feeds the monthly cash-flow curves in **CashFlow** and the factory-level P&L in **W2W Report**. A bid that moves from RFQ stage to final offer can be tracked end-to-end — Gantt, headcount, cost, risk, responsibility matrix, and commercial letter — without ever switching applications or copy-pasting a cell. This is the workflow integration that enterprise teams spend six-figure budgets trying to achieve with ERP plugins; PYL0N delivers it out of the box.

### 4. Salesforce-Native CRM Integration

Bid managers live in Salesforce. PYL0N's **ForeCast** module bridges the gap with a production-grade Excel importer that handles the full complexity of real Salesforce exports: metadata rows, visual grouping headers (where the quarter label appears once and all data rows beneath it inherit it), sort-arrow suffixes on column headers, EU/US number formatting, merged cells producing sparse arrays, and formatted percentage strings. The importer is stateful — it remembers the last-seen quarter group and cascades it to every opportunity beneath it, so nothing defaults to Q1 incorrectly. Field mapping covers `Account Name`, `Amount in EUR`, `Proposal Manager`, `Stage`, and `Sales Comments` out of the box, with graceful fallbacks for every variant. The result is a live pipeline dashboard with per-quarter overlap analysis, Bid Manager workload cards, and dynamic filters — built from a Salesforce export in under 10 seconds.

### 5. Built to Last — Maintainable, Auditable, Extensible

PYL0N is written in vanilla HTML, CSS, and JavaScript with no build pipeline, no transpiler, no framework churn. Every tool is a single self-contained file: open it in a text editor and every line of logic is right there. This is a deliberate architectural choice — it means the suite can be audited, modified, or extended by any developer on your team without onboarding, without toolchain setup, and without vendor lock-in. The shared `vendor/pyl0n-native.js` bridge provides native file dialog integration for the Electron app while silently falling back to browser blob downloads, so the same codebase runs in both environments without branching. State management follows a strict `collectState()` / `applyState()` pattern across all 12 tools, making backup, restore, and cross-tool import deterministic. When requirements change — and they always do — PYL0N is the kind of codebase you can hand to a new engineer on day one.

---

## Tools

| File | Tool | Purpose |
|------|------|---------|
| `index.html` | Dashboard | Navigation hub + suite-wide master import/export |
| `timecast.html` | TimeCast | Multi-project Gantt with baselines, month/week/quarter scales |
| `resourcecast.html` | ResourceCast | Team allocation, FTE calc, monthly cost grid, resource Gantt |
| `orgcast.html` | OrgCast | Org chart generator (landscape/portrait/A3) with SVG connectors |
| `rfqcast.html` | RFQCast | Supplier RFQ tracking dashboard, push to CalcCast |
| `dorcast.html` | DORCast | RACI/DOR responsibility matrix builder |
| `riskcast.html` | RiskCast | Risk & opportunity register with 5×5 scoring matrix |
| `calccast.html` | CalcCast | Cost breakdown calculator; receives winning quotes from RFQCast |
| `lettercast.html` | LetterCast | Commercial cover letter / offer document generator |
| `cashflow.html` | CashFlow | Monthly cash-flow simulation with per-item cost distribution |
| `w2w-report.html` | W2W Report | Wall-to-Wall financial report (factory KPI breakdown + P&L) |
| `cvcast.html` | CVCast | CV / résumé generator with two-column A4 PDF export |
| `forecast.html` | ForeCast | Pipeline & overlap monitor with Salesforce Excel importer |

## Run it

Open any `.html` file directly in a browser — no install, no build:

```bash
open index.html
# or serve the whole suite over localhost:
python3 -m http.server 8080   # visit http://localhost:8080
```

All libraries (XLSX, html2pdf, html2canvas, Chart.js) and fonts (DM Sans, DM Mono) are bundled in `libs/`. Populate once after cloning:

```bash
node scripts/download-libs.js
```

## Electron Desktop App

```bash
npm install
npm start              # opens the app with DevTools available
npm run build:mac      # produces dist/PYL0N-*.dmg
```

Build guide: [`BUILD.md`](BUILD.md) · AI-assistant reference: [`CLAUDE.md`](CLAUDE.md)

## Storage

All data persists in the browser via `localStorage` under the `bidcast_` prefix. No cookies, no IndexedDB, no server storage. Data never leaves the device.

## Version

Current release: **v2.0.0**
