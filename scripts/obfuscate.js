#!/usr/bin/env node
/**
 * scripts/obfuscate.js
 *
 * Pre-build obfuscation step.
 * Reads every HTML tool file, extracts inline <script> blocks,
 * obfuscates the JS with javascript-obfuscator, and writes the result
 * to a temporary build staging directory (dist-src/) so the originals
 * are never modified.
 *
 * Called automatically by the "prebuild:*" npm scripts.
 * electron-builder is then pointed at dist-src/ instead of the root.
 *
 * Usage:
 *   node scripts/obfuscate.js            → obfuscates into dist-src/
 *   node scripts/obfuscate.js --verify   → dry-run, prints stats only
 */

const fs   = require('fs');
const path = require('path');

// Require the obfuscator — installed as a devDependency.
// If not yet installed (dev mode / npm start), skip obfuscation silently.
let JavaScriptObfuscator;
try {
  JavaScriptObfuscator = require('javascript-obfuscator');
} catch (_) {
  console.warn('[obfuscate] javascript-obfuscator not found — skipping (dev mode).');
  process.exit(0);
}

// ── Configuration ────────────────────────────────────────────────────────────

const ROOT    = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist-src');

// HTML files to obfuscate (all tools + landing page)
const HTML_FILES = [
  'index.html',
  'timecast.html',
  'resourcecast.html',
  'orgcast.html',
  'rfqcast.html',
  'dorcast.html',
  'riskcast.html',
  'calccast.html',
  'lettercast.html',
  'cashflow.html',
  'w2w-report.html',
];

// Non-HTML files to copy verbatim into dist-src/
const COPY_FILES = [
  'main.js',
  'preload.js',
  'auth.js',
  'favicon.svg',
  'logo.svg',
];

const COPY_DIRS = ['vendor', 'build'];

// javascript-obfuscator options — strong but safe for local-only apps.
// No domain lock, no debug protection (breaks DevTools error messages).
const OBF_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  debugProtection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,          // keep top-level names so HTML onclick="" still works
  rotateStringArray: true,
  selfDefending: false,          // can cause issues in Electron's renderer
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,    // false = safer for objects used in HTML attributes
  unicodeEscapeSequence: false,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const VERIFY = process.argv.includes('--verify');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  ensureDir(dst);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Replace each <script>...</script> block (no src=) with its obfuscated form.
function obfuscateHtml(html, filename) {
  let blockCount = 0;
  let totalOrigLen = 0;
  let totalObfLen  = 0;

  const result = html.replace(
    /(<script(?![^>]*\bsrc\s*=)[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (match, open, body, close) => {
      const trimmed = body.trim();
      if (!trimmed) return match;  // empty block

      blockCount++;
      totalOrigLen += trimmed.length;

      if (VERIFY) {
        totalObfLen += trimmed.length; // no-op in verify mode
        return match;
      }

      try {
        const obf = JavaScriptObfuscator.obfuscate(trimmed, OBF_OPTIONS).getObfuscatedCode();
        totalObfLen += obf.length;
        return open + '\n' + obf + '\n' + close;
      } catch (err) {
        console.error(`  [!] Failed to obfuscate a block in ${filename}: ${err.message}`);
        return match; // fall back to original if obfuscation fails
      }
    }
  );

  return { result, blockCount, totalOrigLen, totalObfLen };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n[obfuscate] ${VERIFY ? 'DRY RUN — ' : ''}Obfuscating HTML tools into dist-src/\n`);

  if (!VERIFY) {
    // Clean and recreate output directory
    if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
    ensureDir(OUT_DIR);
  }

  let totalBlocks = 0;
  let totalOrig   = 0;
  let totalObf    = 0;

  // Process HTML files
  for (const filename of HTML_FILES) {
    const srcPath = path.join(ROOT, filename);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  [skip] ${filename} not found`);
      continue;
    }

    const html = fs.readFileSync(srcPath, 'utf8');
    const { result, blockCount, totalOrigLen, totalObfLen } = obfuscateHtml(html, filename);

    if (!VERIFY) {
      fs.writeFileSync(path.join(OUT_DIR, filename), result, 'utf8');
    }

    const ratio = totalOrigLen > 0 ? ((totalObfLen / totalOrigLen) * 100).toFixed(0) : 0;
    console.log(`  ✓ ${filename.padEnd(22)} ${blockCount} block(s)  ${(totalOrigLen/1024).toFixed(1)}KB → ${(totalObfLen/1024).toFixed(1)}KB (${ratio}%)`);

    totalBlocks += blockCount;
    totalOrig   += totalOrigLen;
    totalObf    += totalObfLen;
  }

  if (!VERIFY) {
    // Copy verbatim files
    for (const f of COPY_FILES) {
      const src = path.join(ROOT, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT_DIR, f));
    }

    // Copy directories
    for (const d of COPY_DIRS) {
      copyDir(path.join(ROOT, d), path.join(OUT_DIR, d));
    }

    console.log(`\n  Copied: ${[...COPY_FILES, ...COPY_DIRS].join(', ')}`);
  }

  console.log(`\n[obfuscate] Done. ${totalBlocks} script blocks, ` +
    `${(totalOrig/1024).toFixed(1)}KB → ${(totalObf/1024).toFixed(1)}KB\n`);
}

main();
