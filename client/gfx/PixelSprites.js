/**
 * Symbol sprites — pixel art, drawn procedurally.
 * Each sprite is an array of strings: '.' = transparent, letter = palette key.
 * Standard symbols are 9×9.
 *
 * Palette keys:
 *   R = red, B = blue, G = gold, E = green, P = purple,
 *   W = white, K = black, D = darkGray, N = neonPink,
 *   Y = darkGold, r = darkRed, b = darkBlue, g = darkGreen, p = darkPurple
 */

import { PAL } from './PaletteDB.js';

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
  '1': PAL.deepBlue,  '2': PAL.shadedBlue, '3': PAL.shadedCyan,
};

const SIZE = 9;

// prettier-ignore
const SPRITES = {
  // ── Commons ──
  red: [ // red gem
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
  blue: [ // blue orb
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

  // ── Uncommons ──
  cherry: [ // cherries
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
  // ── UI ──
  ball: [ // roulette ball
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

  // ── Rares ──

  // ── Legendaries ──
  void: [ // void spiral
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

  // ── Relic sprites (for forge shop) ──
  relic_common: [ // small potion
    '...LLL...',
    '...LWL...',
    '...LLL...',
    '..LLWLL..',
    '..LLLLL..',
    '..LLLLL..',
    '..LLLLL..',
    '...LLL...',
    '.........',
  ],
  relic_uncommon: [ // green gem
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
  relic_rare: [ // blue crystal
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
  relic_legendary: [ // golden crown
    '.N.N.N.N.',
    '.NNNNNNN.',
    '.NWWNWWN.',
    '.NNNNNNN.',
    '..NNNNN..',
    '..GGGGG..',
    '..GWGWG..',
    '..GGGGG..',
    '.........',
  ],
  anvil: [ // forge anvil
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
  reroll: [ // dice reroll icon
    '.........',
    '.WWWWWWW.',
    '.W.W.W.W.',
    '.WWWWWWW.',
    '.W.W.W.W.',
    '.WWWWWWW.',
    '.W.W.W.W.',
    '.WWWWWWW.',
    '.........',
  ],
  arrow_right: [ // leave/next arrow
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
  skull: [ // corruption skull
    '..pWWWp..',
    '.pWWWWWp.',
    'pWK.W.KWp',
    'pWWWWWWWp',
    '.pWK.KWp.',
    '..pWWWp..',
    '...W.W...',
    '..W...W..',
    '.........',
  ],
};


// Pre-render each sprite to an offscreen canvas for fast blitting
const _cache = new Map();

function _render(id) {
  if (_cache.has(id)) return _cache.get(id);
  const data = SPRITES[id];
  if (!data) return null;

  const h = data.length;
  const w = data[0].length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  for (let y = 0; y < h; y++) {
    const row = data[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = COLOR_KEY[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  _cache.set(id, c);
  return c;
}

/**
 * Draw a symbol sprite onto ctx at (dx, dy) with given pixel scale.
 */
export function drawSprite(ctx, symbolId, dx, dy, scale = 1) {
  const src = _render(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, src.width * scale, src.height * scale);
}

/**
 * Draw sprite centered at (cx, cy).
 */
export function drawSpriteCentered(ctx, symbolId, cx, cy, scale = 1) {
  const src = _render(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const hw = (src.width * scale) / 2;
  const hh = (src.height * scale) / 2;
  ctx.drawImage(src, 0, 0, src.width, src.height, Math.round(cx - hw), Math.round(cy - hh), src.width * scale, src.height * scale);
}

export const SPRITE_SIZE = SIZE;



// ═══ Animated sprites (multi-frame) ═══

// prettier-ignore
const ANIM_SPRITES = {
  coin: [
    [ // Frame 0: full face
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
    [ // Frame 1: face cropped 1px each side
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
    [ // Frame 2: edge
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
    [ // Frame 3: face cropped 1px each side
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

const _animCache = new Map();

function _renderAnimFrame(id, frame) {
  const key = id + '_' + frame;
  if (_animCache.has(key)) return _animCache.get(key);
  const frames = ANIM_SPRITES[id];
  if (!frames || !frames[frame]) return null;
  const data = frames[frame];
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d');
  for (let y = 0; y < SIZE; y++) {
    const row = data[y];
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const col = COLOR_KEY[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  _animCache.set(key, c);
  return c;
}

/**
 * Draw an animated sprite centered at (cx, cy).
 * @param {string} id  'coin'
 * @param {number} time  game time in seconds (picks frame)
 * @param {number} fps  animation speed (default 6)
 */
export function drawAnimSpriteCentered(ctx, id, cx, cy, scale = 1, time = 0, fps = 6) {
  const frames = ANIM_SPRITES[id];
  if (!frames) return;
  const frame = Math.floor(time * fps) % frames.length;
  const src = _renderAnimFrame(id, frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, Math.round(cx - half), Math.round(cy - half), SIZE * scale, SIZE * scale);
}

/**
 * Draw a specific frame of an animated sprite centered at (cx, cy).
 */
export function drawAnimFrameCentered(ctx, id, frame, cx, cy, scale = 1) {
  const src = _renderAnimFrame(id, frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, Math.round(cx - half), Math.round(cy - half), SIZE * scale, SIZE * scale);
}

export function getAnimFrameCount(id) {
  return ANIM_SPRITES[id]?.length ?? 0;
}
