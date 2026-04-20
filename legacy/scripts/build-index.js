#!/usr/bin/env node
/**
 * Generate dist/index.html — landing page linking to all 6 palette variants.
 */
import { readdirSync, writeFileSync, statSync } from 'fs';
import { resolve } from 'path';

const DIST = resolve(import.meta.dirname, '..', 'dist');

const variants = readdirSync(DIST)
  .filter(d => statSync(resolve(DIST, d)).isDirectory())
  .sort();

const labels = {
  '1-classic-casino': '1 · Classic Casino',
  '2-noir-velvet':    '2 · Noir / Velvet Lounge',
  '3-peach-fuzz':     '3 · Peach Fuzz 2024',
  '4-ultra-violet':   '4 · Ultra Violet / Neon Noir',
  '5-emerald-vault':  '5 · Emerald Vault',
  '6-mocha-mousse':   '6 · Mocha Mousse 2025',
};

const cards = variants.map(slug => {
  const label = labels[slug] || slug;
  return `
    <a href="./${slug}/" class="card">
      <div class="preview" style="background: ${getBg(slug)}"></div>
      <span>${label}</span>
    </a>`;
}).join('\n');

function getBg(slug) {
  const bgs = {
    '1-classic-casino': 'linear-gradient(135deg, #0b0a0d, #be3455, #0f4c81)',
    '2-noir-velvet':    'linear-gradient(135deg, #07070c, #a32638, #1b3a6b)',
    '3-peach-fuzz':     'linear-gradient(135deg, #0e0a08, #e0a96d, #2a6478)',
    '4-ultra-violet':   'linear-gradient(135deg, #08060f, #5f4b8b, #ff4ad1)',
    '5-emerald-vault':  'linear-gradient(135deg, #060a08, #009b48, #d4a017)',
    '6-mocha-mousse':   'linear-gradient(135deg, #0c0908, #c8963e, #3a6080)',
  };
  return bgs[slug] || '#111';
}

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spinforge — Palette Comparison</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0a; color: #eee; font-family: system-ui, sans-serif; padding: 2rem; }
    h1 { text-align: center; margin-bottom: 2rem; font-size: 1.8rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
    .card { display: block; text-decoration: none; color: #eee; border: 1px solid #333; border-radius: 12px; overflow: hidden; transition: transform .15s, border-color .15s; }
    .card:hover { transform: translateY(-4px); border-color: #888; }
    .preview { height: 140px; }
    .card span { display: block; padding: .8rem 1rem; font-weight: 600; font-size: .95rem; background: #141414; }
  </style>
</head>
<body>
  <h1>🎰 Spinforge — 6 Palette Variants</h1>
  <div class="grid">${cards}
  </div>
</body>
</html>`;

writeFileSync(resolve(DIST, 'index.html'), html);
console.log(`✓ dist/index.html generated (${variants.length} variants)`);
