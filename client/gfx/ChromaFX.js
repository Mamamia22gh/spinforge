/**
 * Chromatic aberration FX — reusable per-element effect.
 * Draws red ghost shifted right, blue ghost shifted left,
 * then the original on top.  Pure pixel art, no shaders.
 */

import { PAL } from './PaletteDB.js';
import { drawText, drawTextCentered } from './BitmapFont.js';
import { drawSpriteCentered } from './PixelSprites.js';

// ── Text ──

export function chromaText(ctx, text, x, y, color, scale = 1, offset = 1) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.35;
  drawText(ctx, text, x + offset, y, PAL.red, scale);
  drawText(ctx, text, x - offset, y, PAL.blue, scale);
  ctx.globalAlpha = a;
  drawText(ctx, text, x, y, color, scale);
}

export function chromaTextCentered(ctx, text, cx, y, color, scale = 1, offset = 1) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.35;
  drawTextCentered(ctx, text, cx + offset, y, PAL.red, scale);
  drawTextCentered(ctx, text, cx - offset, y, PAL.blue, scale);
  ctx.globalAlpha = a;
  drawTextCentered(ctx, text, cx, y, color, scale);
}

// ── Sprites ──

export function chromaSpriteCentered(ctx, id, cx, cy, scale = 1, offset = 1) {
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * 0.25;
  drawSpriteCentered(ctx, id, cx + offset, cy, scale);
  drawSpriteCentered(ctx, id, cx - offset, cy, scale);
  ctx.globalAlpha = a;
  drawSpriteCentered(ctx, id, cx, cy, scale);
}
