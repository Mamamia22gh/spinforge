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
