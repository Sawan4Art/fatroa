#!/usr/bin/env node
/**
 * Build script: assembles www/ — the self-contained offline bundle used by
 * Capacitor (APK/IPA) and Electron (EXE).
 *
 *   node build-www.js
 *
 * Copies: index.html, assets/, manifest.webmanifest, firebase-applet-config.json
 * Verifies every local reference exists — build FAILS on missing files.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const WWW = path.join(ROOT, 'www');

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

const copies = ['index.html', 'manifest.webmanifest', 'firebase-applet-config.json'];
for (const f of copies) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(WWW, f));
    console.log('copied', f);
  } else {
    console.warn('SKIP (missing):', f);
  }
}

if (fs.existsSync(path.join(ROOT, 'assets'))) {
  fs.cpSync(path.join(ROOT, 'assets'), path.join(WWW, 'assets'), { recursive: true });
  console.log('copied assets/');
}

// --- Verify all local refs in index.html ---
const html = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="(?!https?:|data:|#|\/\/)([^"]+)"/g)]
  .map(m => m[1].split('#')[0].split('?')[0])
  .filter(r => r
    && !r.startsWith('{{')
    && !r.includes('${')            // JS template literals, not real refs
    && !/^[a-zA-Z]+:/.test(r));     // any URI scheme (mailto:, tel:, ...)

let missing = 0;
for (const r of new Set(refs)) {
  const p = path.join(WWW, decodeURIComponent(r));
  if (!fs.existsSync(p)) { console.error('MISSING REF:', r); missing++; }
}

if (missing > 0) {
  console.error(`www/ build FAILED — ${missing} missing reference(s)`);
  process.exit(1);
}
console.log(`checked ${new Set(refs).size} local refs, missing: ${missing}`);
console.log('www/ build complete →', WWW);
