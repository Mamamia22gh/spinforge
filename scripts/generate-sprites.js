#!/usr/bin/env node
/**
 * Generate PNG sprite assets from inline pixel-art data.
 * No external dependencies — uses Node.js built-in zlib for DEFLATE.
 *
 * Usage: node scripts/generate-sprites.js
 * Output: public/assets/{category}/{name}.png
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { deflateSync } from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'assets');

// ── Palette (RGB) ──
const PAL = {
  black:      [0x0a, 0x0a, 0x0a],
  darkGray:   [0x1a, 0x1a, 0x2e],
  midGray:    [0x33, 0x33, 0x46],
  lightGray:  [0x6a, 0x6a, 0x7a],
  white:      [0xe8, 0xe0, 0xd0],
  red:        [0xcc, 0x22, 0x33],
  darkRed:    [0x6e, 0x11, 0x27],
  blue:       [0x2b, 0x4c, 0xcc],
  darkBlue:   [0x16, 0x22, 0x66],
  gold:       [0xd4, 0xa5, 0x20],
  darkGold:   [0x7a, 0x5e, 0x10],
  green:      [0x22, 0xaa, 0x44],
  darkGreen:  [0x10, 0x55, 0x22],
  purple:     [0x88, 0x33, 0xcc],
  darkPurple: [0x44, 0x1a, 0x66],
  neonPink:   [0xff, 0x44, 0xaa],
  cyan:       [0x44, 0xaa, 0xdd],
  darkCyan:   [0x00, 0x88, 0xbb],
  deepBlue:   [0x0e, 0x11, 0x44],
  shadedBlue: [0x1a, 0x2e, 0x88],
  shadedCyan: [0x33, 0x77, 0x99],
};

const COLOR_KEY = {
  'R': PAL.red,      'r': PAL.darkRed,
  'B': PAL.blue,     'b': PAL.darkBlue,
  'G': PAL.gold,     'Y': PAL.darkGold,
  'E': PAL.green,    'g': PAL.darkGreen,
  'P': PAL.purple,   'p': PAL.darkPurple,
  'W': PAL.white,    'D': PAL.midGray,
  'K': PAL.black,    'N': PAL.neonPink,
  'L': PAL.lightGray,
  'C': PAL.cyan,     'c': PAL.darkCyan,
  '1': PAL.deepBlue, '2': PAL.shadedBlue, '3': PAL.shadedCyan,
};

// ── Sprite data (copied from PixelSprites.js) ──
const SPRITES = {
  red: [
    '....R....',
    '...RRR...',
    '..RRWRR..',
    '.RRRWRRR.',
    'RRRRrRRRR',
    '.RRRrRRR.',
    '..RRrRR..',
    '...RRR...',
    '....R....',
  ],
  blue: [
    '...BBB...',
    '..BWBBB..',
    '.BWBBBB..',
    '.BBBBBBB.',
    '.BBBBBBB.',
    '.BBBBbBB.',
    '..BBbBB..',
    '...BBB...',
    '.........',
  ],
  cherry: [
    '....ggg..',
    '...g..g..',
    '..g...g..',
    '.RR..RR..',
    'RRWR.RRW.',
    'RRRR.RRRR',
    '.RRr..RRr',
    '..RR...RR',
    '.........',
  ],
  ball: [
    '.........',
    '.........',
    '...WWW...',
    '..WWWWW..',
    '..WWWWW..',
    '..WWWWW..',
    '...WWW...',
    '.........',
    '.........',
  ],
  void: [
    '...ppp...',
    '..p...p..',
    '.p.PPP.p.',
    '.p.P.P.p.',
    '.p.P...p.',
    '.p.PPPp..',
    '.p.....p.',
    '..p...p..',
    '...ppp...',
  ],
  relic_common: [
    '....L....',
    '...LWL...',
    '..LWWWL..',
    '..LWWLL..',
    '.LLLLLLL.',
    '..LLDLL..',
    '...LDL...',
    '....L....',
    '.........',
  ],
  relic_uncommon: [
    '....E....',
    '...EWE...',
    '..EWWWE..',
    '.EEWWEEE.',
    '.EEEEEEE.',
    '..EEgEE..',
    '...EgE...',
    '....E....',
    '.........',
  ],
  relic_rare: [
    '....B....',
    '...BWB...',
    '..BWWWB..',
    '..BWWBB..',
    '.BBBBBBB.',
    '..BBbBB..',
    '...BbB...',
    '....B....',
    '.........',
  ],
  relic_legendary: [
    '....G....',
    '...GWG...',
    '..GWWWG..',
    '..GWWGG..',
    '.GGGGGGG.',
    '..GGYGG..',
    '...GYG...',
    '....G....',
    '.........',
  ],
  anvil: [
    '.........',
    '.DDDDDDD.',
    'DDDWWDDDD',
    'DDDDDDDDD',
    '..DDDDD..',
    '..DDDDD..',
    '.DDDDDDD.',
    'DDDDDDDDD',
    '.........',
  ],
  reroll: [
    '..WWW....',
    '.W...WW..',
    'W.....W..',
    'W........',
    '.........',
    '........W',
    '..W.....W',
    '..WW...W.',
    '....WWW..',
  ],
  arrow_right: [
    '.........',
    '...W.....',
    '...WW....',
    '...WWW...',
    '...WWWW..',
    '...WWW...',
    '...WW....',
    '...W.....',
    '.........',
  ],
  ticket: [
    '.K.K.K.K.K.K.K.',
    'KgKgKgKgKgKgKgK',
    'KgEEEEEEEgKEEgK',
    'KgEWEEEWEgKEEgK',
    'KKEEEEEEEgKEEKK',
    'KgEWEEEWEgKEEgK',
    'KgEEEEEEEgKEEgK',
    'KgKgKgKgKgKgKgK',
    '.K.K.K.K.K.K.K.',
  ],
  skull: [
    '..pWWWp..',
    '.pWWWWWp.',
    'pWK.W.KWp',
    'pWWWWWWWp',
    '..pW.Wp..',
    '..pWWWp..',
    '...ppp...',
    '.........',
    '.........',
  ],
};

const ANIM_SPRITES = {
  coin: [
    [
      '...KKK...',
      '..KWGGK..',
      '.KGGGGGK.',
      '.KGGGGGK.',
      '.KGGGGGK.',
      '.KGGGGGK.',
      '..KYYYK..',
      '...KKK...',
      '.........',
    ],
    [
      '....K....',
      '...KWK...',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '...KYK...',
      '....K....',
      '.........',
    ],
    [
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '....K....',
      '.........',
    ],
    [
      '....K....',
      '...KWK...',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '..KGGGK..',
      '...KYK...',
      '....K....',
      '.........',
    ],
  ],
};

// HIERO_GLYPHS — monochrome white, '#' = pixel
const HIERO_GLYPHS = {
  gear: [
    '...........................',
    '..........#######..........',
    '.......#..#######..#.......',
    '......##..#######..##......',
    '....#####..#####..#####....',
    '....#####..#####..#####....',
    '...#######.#####.#######...',
    '..#######################..',
    '....###################....',
    '......###############......',
    '.###...#####...#####...###.',
    '.##########.....##########.',
    '.#########.......#########.',
    '.#########.......#########.',
    '.#########.......#########.',
    '.##########.....##########.',
    '.###...#####...#####...###.',
    '......###############......',
    '....###################....',
    '..#######################..',
    '...#######.#####.#######...',
    '....#####..#####..#####....',
    '....#####..#####..#####....',
    '......##..#######..##......',
    '.......#..#######..#.......',
    '..........#######..........',
    '...........................',
  ],
  exit: [
    '..............#############',
    '..............#...........#',
    '..............#...........#',
    '..............#..#######..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '.....##.......#..#.....#..#',
    '....###.......#..#.....#..#',
    '...###........#..#######..#',
    '..###.........#...........#',
    '.############.#.........###',
    '#############.#.........###',
    '.############.#.........###',
    '..###.........#...........#',
    '...###........#..#######..#',
    '....###.......#..#.....#..#',
    '.....##.......#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#.....#..#',
    '..............#..#######..#',
    '..............#...........#',
    '..............#...........#',
    '..............#############',
  ],
  book: [
    '...........................',
    '...........................',
    '...........................',
    '...#####################...',
    '...#.........#.........#...',
    '..#..........#..........#..',
    '..#..#####...#...#####..#..',
    '..#..........#..........#..',
    '..#..#####...#...#####..#..',
    '..#..........#..........#..',
    '..#..#####...#...#####..#..',
    '..#..........#..........#..',
    '..#..#####...#...#####..#..',
    '..#..........#..........#..',
    '..#..#####...#...#####..#..',
    '..#..........#..........#..',
    '..#..#####...#...#####..#..',
    '..#..........#..........#..',
    '..#..........#..........#..',
    '...#.........#.........#...',
    '....#########.#########....',
    '....#########.#########....',
    '.....#######...#######.....',
    '...........................',
    '...........................',
    '...........................',
    '...........................',
  ],
};

// ── Minimal PNG encoder ──

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeU32BE(buf, offset, val) {
  buf[offset]     = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  writeU32BE(buf, 0, len);
  typeBytes.copy(buf, 4);
  data.copy(buf, 8);
  const crcData = Buffer.concat([typeBytes, data]);
  writeU32BE(buf, 8 + len, crc32(crcData));
  return buf;
}

function encodePNG(w, h, rgba) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  writeU32BE(ihdr, 0, w);
  writeU32BE(ihdr, 4, h);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT: raw image data with filter byte 0 per row
  const rawSize = h * (1 + w * 4);
  const raw = Buffer.alloc(rawSize);
  for (let y = 0; y < h; y++) {
    const rowOff = y * (1 + w * 4);
    raw[rowOff] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = rowOff + 1 + x * 4;
      raw[dstIdx]     = rgba[srcIdx];     // R
      raw[dstIdx + 1] = rgba[srcIdx + 1]; // G
      raw[dstIdx + 2] = rgba[srcIdx + 2]; // B
      raw[dstIdx + 3] = rgba[srcIdx + 3]; // A
    }
  }

  const compressed = deflateSync(raw);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

// ── Render functions ──

function renderSprite(data, colorKey) {
  const h = data.length;
  const w = data[0].length;
  const rgba = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    const row = data[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const idx = (y * w + x) * 4;
      if (ch === '.') {
        rgba[idx] = rgba[idx + 1] = rgba[idx + 2] = rgba[idx + 3] = 0;
      } else {
        const col = colorKey[ch];
        if (col) {
          rgba[idx]     = col[0];
          rgba[idx + 1] = col[1];
          rgba[idx + 2] = col[2];
          rgba[idx + 3] = 255;
        }
      }
    }
  }
  return { w, h, rgba };
}

function renderHieroGlyph(data) {
  const h = data.length;
  const w = data[0].length;
  const rgba = new Uint8Array(w * h * 4);

  for (let y = 0; y < h; y++) {
    const row = data[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      const idx = (y * w + x) * 4;
      if (ch === '#') {
        rgba[idx]     = PAL.white[0];
        rgba[idx + 1] = PAL.white[1];
        rgba[idx + 2] = PAL.white[2];
        rgba[idx + 3] = 255;
      }
    }
  }
  return { w, h, rgba };
}

function saveSprite(category, name, imgData) {
  const dir = join(OUT, category);
  mkdirSync(dir, { recursive: true });
  const png = encodePNG(imgData.w, imgData.h, imgData.rgba);
  const file = join(dir, `${name}.png`);
  writeFileSync(file, png);
  console.log(`  ✓ ${category}/${name}.png  (${imgData.w}×${imgData.h})`);
}

// ── Category assignments ──

const CATEGORIES = {
  red:              'symbols',
  blue:             'symbols',
  cherry:           'symbols',
  void:             'symbols',

  ball:             'ui',
  anvil:            'ui',
  reroll:           'ui',
  arrow_right:      'ui',
  skull:            'ui',

  relic_common:     'relics',
  relic_uncommon:   'relics',
  relic_rare:       'relics',
  relic_legendary:  'relics',

  ticket:           'currencies',
};

// ── Main ──

console.log('Generating sprite assets...\n');

// Static sprites
for (const [id, data] of Object.entries(SPRITES)) {
  const cat = CATEGORIES[id] || 'misc';
  const img = renderSprite(data, COLOR_KEY);
  saveSprite(cat, id, img);
}

// Animated sprites (one file per frame)
for (const [id, frames] of Object.entries(ANIM_SPRITES)) {
  for (let f = 0; f < frames.length; f++) {
    const img = renderSprite(frames[f], COLOR_KEY);
    saveSprite('currencies', `${id}_${f}`, img);
  }
}

// Hieroglyph menu glyphs
for (const [id, data] of Object.entries(HIERO_GLYPHS)) {
  const img = renderHieroGlyph(data);
  saveSprite('menu', id, img);
}

console.log('\nDone! Assets written to public/assets/');
