#!/usr/bin/env node
/**
 * scripts/download-libs.js
 *
 * Downloads all required libraries into libs/ for fully offline use.
 * Run once after cloning: node scripts/download-libs.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const LIBS_DIR = path.join(__dirname, '..', 'libs');
fs.mkdirSync(LIBS_DIR, { recursive: true });

const LIBS = [
  {
    name: 'xlsx.full.min.js',
    url:  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  },
  {
    name: 'html2pdf.bundle.min.js',
    url:  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  },
  {
    name: 'html2canvas.min.js',
    url:  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  },
  {
    name: 'chart.js',
    url:  'https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ✓ ${path.basename(dest)} (already exists, skipping)`);
      return resolve();
    }

    console.log(`  ↓ ${path.basename(dest)}...`);
    const file = fs.createWriteStream(dest);

    function get(u) {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.destroy();
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          file.destroy();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          const size = fs.statSync(dest).size;
          console.log(`    → ${(size / 1024).toFixed(0)} KB`);
          resolve();
        });
      }).on('error', (err) => {
        file.destroy();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    }

    get(url);
  });
}

async function main() {
  console.log('\nDownloading libraries into libs/\n');
  for (const lib of LIBS) {
    await download(lib.url, path.join(LIBS_DIR, lib.name));
  }
  console.log('\nAll libraries downloaded. The suite is now fully offline.\n');
}

main().catch(err => {
  console.error('\nError:', err.message);
  process.exit(1);
});
