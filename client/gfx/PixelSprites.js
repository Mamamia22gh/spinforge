/**
 * 13 symbol sprites — 9×9 pixel art, drawn procedurally.
 * Each sprite is an array of strings: '.' = transparent, letter = palette key.
 * Compact 9×9 for crisp look at small wheel sizes.
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
  gold: [ // gold coin
    '...GGG...',
    '..GWGGG..',
    '.GGGGGGG.',
    '.GG.G.GG.',
    '.GGGGGGG.',
    '.GG.G.GG.',
    '.GGGGGGG.',
    '..YYYYY..',
    '...YYY...',
  ],

  // ── Uncommons ──
  green: [ // green clover
    '..EE.EE..',
    '.EEWEEW..',
    '.EEEEEEE.',
    '..EEEEE..',
    '...gEg...',
    '...gEg...',
    '....g....',
    '....g....',
    '.........',
  ],
  purple: [ // purple crystal
    '....P....',
    '...PPP...',
    '..PPWPP..',
    '..PPPPP..',
    '.PPPPPPP.',
    '.PPPpPPP.',
    '..PPpPP..',
    '...ppp...',
    '.........',
  ],
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
  bell: [ // golden bell
    '...GGG...',
    '..GWGGG..',
    '.GGGGGGG.',
    '.GGGGGGG.',
    '.GGGGGGG.',
    'GGGGGGGGG',
    'YYYYYYYYY',
    '...GGG...',
    '....G....',
  ],

  // ── Rares ──
  diamond: [ // sparkling diamond
    '....W....',
    '...WLW...',
    '..WLWLW..',
    '.WLWLWLW.',
    'WLWLWLWLW',
    '.WLDLDW..',
    '..WDDDW..',
    '...WDW...',
    '....W....',
  ],
  seven: [ // lucky 7
    '.RRRRRRR.',
    '.RRRRRRR.',
    '.....RR..',
    '....RR...',
    '...RWR...',
    '..RWR....',
    '..RR.....',
    '..RR.....',
    '.........',
  ],
  star: [ // star
    '....G....',
    '...GWG...',
    '...GGG...',
    '.GGGGGGG.',
    'GGGGWGGGG',
    '.GGGGGGG.',
    '..GGGGG..',
    '..GG.GG..',
    '.GG...GG.',
  ],

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
  joker: [ // joker face
    '...NNN...',
    '..NWWWN..',
    '.NW.W.WN.',
    '.NWWWWWN.',
    '.NW.N.WN.',
    '.NWNNWWN.',
    '..NWWWN..',
    '...NNN...',
    '.........',
  ],
  phoenix: [ // fire bird
    '...RGR...',
    '..RGGR...',
    '.RGWGGR..',
    '.RGGGGR..',
    'RRRGGRR..',
    '.rRRRR...',
    '..rRRr...',
    '.r..r.r..',
    '.........',
  ],
};

// Pre-render each sprite to an offscreen canvas for fast blitting
const _cache = new Map();

function _render(id) {
  if (_cache.has(id)) return _cache.get(id);
  const data = SPRITES[id];
  if (!data) return null;

  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
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

  _cache.set(id, c);
  return c;
}

/**
 * Draw a symbol sprite onto ctx at (dx, dy) with given pixel scale.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} symbolId — matches symbols.js id
 * @param {number} dx — top-left x
 * @param {number} dy — top-left y
 * @param {number} [scale=1]
 */
export function drawSprite(ctx, symbolId, dx, dy, scale = 1) {
  const src = _render(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, dx, dy, SIZE * scale, SIZE * scale);
}

/**
 * Draw sprite centered at (cx, cy).
 */
export function drawSpriteCentered(ctx, symbolId, cx, cy, scale = 1) {
  const half = (SIZE * scale) / 2;
  drawSprite(ctx, symbolId, Math.round(cx - half), Math.round(cy - half), scale);
}

export const SPRITE_SIZE = SIZE;

// ═══ Animated sprites (multi-frame) ═══

// prettier-ignore
const ANIM_SPRITES = {
  coin: [
    [ // Frame 0: full face
      '..KKKKK..',
      '.KGWGGGK.',
      'KGGGGGGGK',
      'KGGGGGGGK',
      'KGGGGGGGK',
      'KGGGGGGGK',
      'KGGGGGGGK',
      '.KYYYYYK.',
      '..KKKKK..',
    ],
    [ // Frame 1: 3/4 view
      '...KKKK..',
      '..KGWGGK.',
      '.KGGGGGGK',
      '.KGGGGGGK',
      '.KGGGGGGK',
      '.KGGGGGGK',
      '.KGGGGGGK',
      '..KYYYYK.',
      '...KKKK..',
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
      '....K....',
    ],
    [ // Frame 3: 3/4 reverse
      '..KKKK...',
      '.KGGWGK..',
      'KGGGGGGK.',
      'KGGGGGGK.',
      'KGGGGGGK.',
      'KGGGGGGK.',
      'KGGGGGGK.',
      '.KYYYYK..',
      '..KKKK...',
    ],
  ],
  diamond: [
    [ // Frame 0: normal
      '....K....',
      '...KBK...',
      '..KBWBK..',
      '.KBWBWBK.',
      'KBWBWBWBK',
      '.KBWbBK..',
      '..KbbbK..',
      '...KbK...',
      '....K....',
    ],
    [ // Frame 1: sparkle top-right
      '....K..W.',
      '...KBK.W.',
      '..KBWBK..',
      '.KBWBWBK.',
      'KBWBWBWBK',
      '.KBWbBK..',
      '..KbbbK..',
      '...KbK...',
      '....K....',
    ],
    [ // Frame 2: normal
      '....K....',
      '...KBK...',
      '..KBWBK..',
      '.KBWBWBK.',
      'KBWBWBWBK',
      '.KBWbBK..',
      '..KbbbK..',
      '...KbK...',
      '....K....',
    ],
    [ // Frame 3: sparkle bottom-left
      '....K....',
      '...KBK...',
      '..KBWBK..',
      '.KBWBWBK.',
      'KBWBWBWBK',
      '.KBWbBK..',
      '..KbbbK..',
      '.W.KbK...',
      '.W..K....',
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
 * @param {string} id  'coin' or 'diamond'
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
