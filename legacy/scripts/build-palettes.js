#!/usr/bin/env node
/**
 * Build 6 palette variants of Spinforge into dist/<slug>/
 * Usage: node scripts/build-palettes.js
 */
import { execSync } from 'child_process';
import { cpSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const PALETTES_DIR = resolve(ROOT, 'palettes');
const PALETTE_TARGET = resolve(ROOT, 'client/gfx/PaletteDB.js');
const DIST = resolve(ROOT, 'dist');

// Save original
const originalPalette = readFileSync(PALETTE_TARGET, 'utf8');

const palettes = readdirSync(PALETTES_DIR)
  .filter(f => f.endsWith('.js'))
  .sort();

console.log(`Building ${palettes.length} palette variants...\n`);

mkdirSync(DIST, { recursive: true });

for (const file of palettes) {
  const slug = basename(file, '.js'); // e.g. "1-classic-casino"
  const palContent = readFileSync(resolve(PALETTES_DIR, file), 'utf8');

  // Inject palette
  writeFileSync(PALETTE_TARGET, palContent);

  console.log(`► Building: ${slug}`);
  execSync(`npx vite build --base /spinforge/${slug}/`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // Move dist → dist-tmp, then move into final dist/<slug>
  // Vite outputs to ROOT/dist, so we rename it
  const builtDir = resolve(ROOT, 'dist');
  const targetDir = resolve(ROOT, 'dist-all', slug);
  mkdirSync(targetDir, { recursive: true });
  cpSync(builtDir, targetDir, { recursive: true });

  console.log(`  ✓ → dist-all/${slug}/\n`);
}

// Restore original
writeFileSync(PALETTE_TARGET, originalPalette);

// Move dist-all → dist
const { rmSync } = await import('fs');
rmSync(DIST, { recursive: true, force: true });
cpSync(resolve(ROOT, 'dist-all'), DIST, { recursive: true });
rmSync(resolve(ROOT, 'dist-all'), { recursive: true, force: true });

console.log('All variants built into dist/');
