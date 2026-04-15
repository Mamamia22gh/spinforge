/**
 * Tiny 4×6 bitmap font — digits, uppercase, a few symbols.
 * Each glyph is a string of '.' and '#' rows.
 * Drawn pixel-by-pixel via fillRect — zero system font dependency.
 */

const W = 4;
const H = 6;

// prettier-ignore
const GLYPHS = {
  '0': ['.##.','#..#','####','..#.','..#.','....'],
  '1': ['..#.','..#.','..#.','..#.','..#.','....'],
  '2': ['#..#','#..#','#..#','#..#','#..#','....'],
  '3': ['#.##','#.##','#.##','#.##','#.##','....'],
  '4': ['#..#','#..#','....','#..#','#..#','....'],
  '5': ['#.##','#.##','....','#..#','#..#','....'],
  '6': ['#.##','#.##','....','#.##','#.##','....'],
  '7': ['####','####','....','#.##','#.##','....'],
  '8': ['####','####','....','####','####','....'],
  '9': ['#.##','....','#.##','....','#.##','....'],
  'A': ['.##.','#..#','####','#..#','#..#','....'],
  'B': ['###.','#..#','###.','#..#','###.','....'],
  'C': ['.###','#...','#...','#...', '.###','....'],
  'D': ['###.','#..#','#..#','#..#','###.','....'],
  'E': ['####','#...','###.','#...','####','....'],
  'F': ['####','#...','###.','#...','#...','....'],
  'G': ['.###','#...','#.##','#..#','.###','....'],
  'H': ['#..#','#..#','####','#..#','#..#','....'],
  'I': ['###.','.#..','.#..','.#..','###.','....'],
  'J': ['..##','...#','...#','#..#','.##.','....'],
  'K': ['#..#','#.#.','##..','#.#.','#..#','....'],
  'L': ['#...','#...','#...','#...','####','....'],
  'M': ['#..#','####','####','#..#','#..#','....'],
  'N': ['#..#','##.#','#.##','#..#','#..#','....'],
  'O': ['.##.','#..#','#..#','#..#','.##.','....'],
  'P': ['###.','#..#','###.','#...','#...','....'],
  'Q': ['.##.','#..#','#..#','#.#.','.#.#','....'],
  'R': ['###.','#..#','###.','#.#.','#..#','....'],
  'S': ['.###','#...','####','...#','###.','....'],
  'T': ['####','..#.','..#.','..#.','..#.','....'],
  'U': ['#..#','#..#','#..#','#..#','.##.','....'],
  'V': ['#..#','#..#','#..#','.##.','..#.','....'],
  'W': ['#..#','#..#','####','####','#..#','....'],
  'X': ['#..#','.##.','..#.','.##.','#..#','....'],
  'Y': ['#..#','.##.','..#.','..#.','..#.','....'],
  'Z': ['####','..#.','.#..','#...','####','....'],
  '+': ['....','..#.','.###','..#.','....','....'],
  '-': ['....','....','####','....','....','....'],
  '/': ['...#','..#.','.#..','#...','....','....'],
  '×': ['....','#..#','.##.','.##.','#..#','....'],
  '!': ['..#.','..#.','..#.','....','..#.','....'],
  ':': ['....','..#.','....','..#.','....','....'],
  '.': ['....','....','....','....','..#.','....'],
  ' ': ['....','....','....','....','....','....'],
  '?': ['.##.','#..#','..#.','....','..#.','....'],
};

// Pre-parse into bit arrays for speed
const PARSED = {};
for (const [ch, rows] of Object.entries(GLYPHS)) {
  PARSED[ch] = rows.map(r => {
    let bits = 0;
    for (let i = 0; i < W; i++) if (r[i] === '#') bits |= (1 << (W - 1 - i));
    return bits;
  });
}

/**
 * Draw a string onto a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text — uppercased automatically
 * @param {number} x — left pixel
 * @param {number} y — top pixel
 * @param {string} color — fillStyle color
 * @param {number} [scale=1] — pixel size multiplier
 */
export function drawText(ctx, text, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  const str = text.toUpperCase();
  let cx = x;
  for (let c = 0; c < str.length; c++) {
    const bits = PARSED[str[c]];
    if (!bits) { cx += (W + 1) * scale; continue; }
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        if (bits[row] & (1 << (W - 1 - col))) {
          ctx.fillRect(cx + col * scale, y + row * scale, scale, scale);
        }
      }
    }
    cx += (W + 1) * scale;
  }
}

/**
 * Measure text width in pixels (before scaling).
 */
export function measureText(text) {
  return text.length * (W + 1) - 1;
}

/**
 * Draw text centered horizontally at cx.
 */
export function drawTextCentered(ctx, text, cx, y, color, scale = 1) {
  const w = measureText(text) * scale;
  drawText(ctx, text, Math.round(cx - w / 2), y, color, scale);
}

/**
 * Draw text with word-wrap inside maxW pixels.
 * Returns total height used.
 */
export function drawTextWrapped(ctx, text, x, y, maxW, color, scale = 1) {
  const str = text.toUpperCase();
  const words = str.split(' ');
  let line = '';
  let ly = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (measureText(test) * scale > maxW && line) {
      drawText(ctx, line, x, ly, color, scale);
      ly += (H + 2) * scale;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) drawText(ctx, line, x, ly, color, scale);
  return ly + H * scale - y;
}

/**
 * Draw text centered with a 1px black outline.
 */
export function drawTextCenteredOutlined(ctx, text, cx, y, color, scale = 1, outline = '#000') {
  const w = measureText(text) * scale;
  const x = Math.round(cx - w / 2);
  ctx.fillStyle = outline;
  const str = text.toUpperCase();
  // 4-direction outline
  for (const [ox, oy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let px = x + ox * scale;
    for (let c = 0; c < str.length; c++) {
      const bits = PARSED[str[c]];
      if (!bits) { px += (W + 1) * scale; continue; }
      for (let row = 0; row < H; row++) {
        for (let col = 0; col < W; col++) {
          if (bits[row] & (1 << (W - 1 - col))) {
            ctx.fillRect(px + col * scale, y + oy * scale + row * scale, scale, scale);
          }
        }
      }
      px += (W + 1) * scale;
    }
  }
  drawText(ctx, text, x, y, color, scale);
}

export const CHAR_W = W;
export const CHAR_H = H;
