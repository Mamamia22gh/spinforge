/**
 * Symbol sprites — loaded from PNG assets in public/assets/.
 * Each sprite is pre-rendered to an offscreen canvas for fast blitting.
 *
 * Call `preloadSprites()` before game start to load all assets.
 */

const SIZE = 9;

// ── Sprite manifest: id → { path, w, h } ──
const BASE = import.meta.env.BASE_URL ?? '/';

const SPRITE_MANIFEST = {
  // Symbols
  red:              { path: 'assets/symbols/red.png',              w: 9,  h: 9 },
  blue:             { path: 'assets/symbols/blue.png',             w: 9,  h: 9 },
  cherry:           { path: 'assets/symbols/cherry.png',           w: 9,  h: 9 },
  void:             { path: 'assets/symbols/void.png',             w: 9,  h: 9 },

  // UI
  ball:             { path: 'assets/ui/ball.png',                  w: 9,  h: 9 },
  anvil:            { path: 'assets/ui/anvil.png',                 w: 9,  h: 9 },
  reroll:           { path: 'assets/ui/reroll.png',                w: 9,  h: 9 },
  arrow_right:      { path: 'assets/ui/arrow_right.png',           w: 9,  h: 9 },
  skull:            { path: 'assets/ui/skull.png',                 w: 9,  h: 9 },

  // Relics
  relic_common:     { path: 'assets/relics/relic_common.png',      w: 9,  h: 9 },
  relic_uncommon:   { path: 'assets/relics/relic_uncommon.png',    w: 9,  h: 9 },
  relic_rare:       { path: 'assets/relics/relic_rare.png',        w: 9,  h: 9 },
  relic_legendary:  { path: 'assets/relics/relic_legendary.png',   w: 9,  h: 9 },

  // Currencies
  ticket:           { path: 'assets/currencies/ticket.png',        w: 15, h: 9 },

  // Menu glyphs (from hieroglyph ring)
  gear:             { path: 'assets/menu/gear.png',                w: 27, h: 27 },
  exit:             { path: 'assets/menu/exit.png',                w: 27, h: 27 },
  book:             { path: 'assets/menu/book.png',                w: 27, h: 27 },
};

// Animated sprite manifest: id → { frames: [path, ...], w, h }
const ANIM_MANIFEST = {
  coin: {
    frames: [
      'assets/currencies/coin_0.png',
      'assets/currencies/coin_1.png',
      'assets/currencies/coin_2.png',
      'assets/currencies/coin_3.png',
    ],
    w: 9, h: 9,
  },
};

// ── Internal caches ──
const _cache = new Map();
const _animCache = new Map();
const _animFrameCounts = new Map();

function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${src}`));
    img.src = src;
  });
}

/**
 * Preload all sprite assets. Must be called (and awaited) before drawing.
 */
export async function preloadSprites() {
  const promises = [];

  // Static sprites
  for (const [id, info] of Object.entries(SPRITE_MANIFEST)) {
    promises.push(
      _loadImage(BASE + info.path).then(canvas => {
        _cache.set(id, canvas);
      })
    );
  }

  // Animated sprites
  for (const [id, info] of Object.entries(ANIM_MANIFEST)) {
    _animFrameCounts.set(id, info.frames.length);
    for (let f = 0; f < info.frames.length; f++) {
      promises.push(
        _loadImage(BASE + info.frames[f]).then(canvas => {
          _animCache.set(id + '_' + f, canvas);
        })
      );
    }
  }

  await Promise.all(promises);
}

/**
 * Draw a symbol sprite onto ctx at (dx, dy) with given pixel scale.
 */
export function drawSprite(ctx, symbolId, dx, dy, scale = 1) {
  const src = _cache.get(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, src.width * scale, src.height * scale);
}

/**
 * Draw sprite centered at (cx, cy).
 */
export function drawSpriteCentered(ctx, symbolId, cx, cy, scale = 1) {
  const src = _cache.get(symbolId);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const hw = (src.width * scale) / 2;
  const hh = (src.height * scale) / 2;
  ctx.drawImage(src, 0, 0, src.width, src.height, Math.round(cx - hw), Math.round(cy - hh), src.width * scale, src.height * scale);
}

/**
 * Draw an animated sprite centered at (cx, cy).
 * @param {string} id  'coin'
 * @param {number} time  game time in seconds (picks frame)
 * @param {number} fps  animation speed (default 6)
 */
export function drawAnimSpriteCentered(ctx, id, cx, cy, scale = 1, time = 0, fps = 6) {
  const count = _animFrameCounts.get(id);
  if (!count) return;
  const frame = Math.floor(time * fps) % count;
  const src = _animCache.get(id + '_' + frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, Math.round(cx - half), Math.round(cy - half), SIZE * scale, SIZE * scale);
}

/**
 * Draw a specific frame of an animated sprite centered at (cx, cy).
 */
export function drawAnimFrameCentered(ctx, id, frame, cx, cy, scale = 1) {
  const src = _animCache.get(id + '_' + frame);
  if (!src) return;
  ctx.imageSmoothingEnabled = false;
  const half = (SIZE * scale) / 2;
  ctx.drawImage(src, 0, 0, SIZE, SIZE, Math.round(cx - half), Math.round(cy - half), SIZE * scale, SIZE * scale);
}

export function getAnimFrameCount(id) {
  return _animFrameCounts.get(id) ?? 0;
}

export const SPRITE_SIZE = SIZE;
export const TICKET_W = 15;
export const TICKET_H = 9;
