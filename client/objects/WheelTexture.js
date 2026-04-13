import * as THREE from 'three';
import { getSymbol } from '../../src/data/symbols.js';

const COLORS = {
  red: '#cc2233', blue: '#2244cc', gold: '#d4a520',
  green: '#22aa44', purple: '#8833cc', white: '#ccccee',
  void: '#330055', wild: '#ff44ff',
};

/**
 * Generate a CanvasTexture for the inside disc of the roulette model.
 * Draws colored segments matching the game's wheel data.
 * UV mapping: disc is a circle mapped to a square texture.
 */
export function createWheelTexture(wheelData, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 2;

  // Background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, size, size);

  const totalWeight = wheelData.reduce((s, w) => s + w.weight, 0);
  let angleOffset = -Math.PI / 2; // start at top

  // Alternating casino red/black
  const slotColors = ['#cc1122', '#111111'];

  for (let i = 0; i < wheelData.length; i++) {
    const seg = wheelData[i];
    const angle = (seg.weight / totalWeight) * Math.PI * 2;
    const sym = getSymbol(seg.symbolId);
    const gameColor = COLORS[sym.color] || '#888';
    const casinoColor = slotColors[i % 2];

    // Draw segment
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angleOffset, angleOffset + angle);
    ctx.closePath();

    // Blend casino + game color
    ctx.fillStyle = casinoColor;
    ctx.fill();

    // Game color overlay (subtle)
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = gameColor;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Gold divider line
    ctx.strokeStyle = '#d4a520';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Symbol emoji in the segment
    const midAngle = angleOffset + angle / 2;
    const labelR = R * 0.65;
    const tx = cx + Math.cos(midAngle) * labelR;
    const ty = cy + Math.sin(midAngle) * labelR;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(R * 0.12)}px serif`;
    ctx.fillText(sym.emoji, 0, 0);
    ctx.restore();

    // Number in outer ring
    const numR = R * 0.88;
    const nx = cx + Math.cos(midAngle) * numR;
    const ny = cy + Math.sin(midAngle) * numR;

    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(R * 0.06)}px monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(String(i + 1), 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();

    // 🍀 clover in inner ring (near hub)
    const cloverR = R * 0.3;
    const clx = cx + Math.cos(midAngle) * cloverR;
    const cly = cy + Math.sin(midAngle) * cloverR;

    ctx.save();
    ctx.translate(clx, cly);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(R * 0.06)}px serif`;
    ctx.fillText('🍀', 0, 0);
    ctx.restore();

    angleOffset += angle;
  }

  // Center circle (turret area — dark)
  const innerR = R * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#d4a520';
  ctx.lineWidth = 2;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false; // GLB models typically have flipY = false
  return tex;
}
