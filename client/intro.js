/**
 * Splash screen & wheel build animation.
 * Runs BEFORE App instantiation on an overlay canvas.
 */
import { PAL } from './gfx/PaletteDB.js';
import { drawText, drawTextCentered, measureText, CHAR_W, CHAR_H } from './gfx/BitmapFont.js';

const W = 480, H = 270, PX = 2, CW = W * PX, CH = H * PX;
const CX = W / 2, CY = H / 2;
const WCX = 240, WCY = 140;
const TWO_PI = Math.PI * 2;

// ── Wheel geometry (mirrors PixelWheel.js) ──
const R       = 150;
const HUB_R   = Math.round(R * 0.28);
const PKT_IN  = Math.round(R * 0.30);
const PKT_OUT = Math.round(R * 0.37);
const LBL_IN  = Math.round(R * 0.38);
const LBL_OUT = Math.round(R * 0.48);
const RIM_R   = Math.round(R * 0.55);
const N_SEG   = 40;
const SEG_ARC = TWO_PI / N_SEG;
const INIT_A  = -Math.PI / 2 - Math.PI / N_SEG;
const N_HIERO = 16;
const HIERO_ARC = TWO_PI / N_HIERO;
const HIERO_INIT = -Math.PI / 2 - Math.PI / N_HIERO;
const H_IN    = 174;
const H_OUT   = 220;

// ── Audio ──
let _ac = null;
function _initAudio() {
  if (_ac) return;
  try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}
function _tone(f, d, type = 'square', v = 0.06) {
  if (!_ac) return;
  const o = _ac.createOscillator(), g = _ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(v, _ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, _ac.currentTime + d);
  o.connect(g).connect(_ac.destination); o.start(); o.stop(_ac.currentTime + d);
}
function _vib(ms) { try { navigator.vibrate?.(ms); } catch {} }

export function getIntroAudioCtx() { return _ac; }

// ── Particles ──
const _parts = [];
function _spawnSparks(cx, cy, n, color, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TWO_PI;
    const v = spd * (0.4 + Math.random() * 0.6);
    _parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
  }
}
function _spawnRingSparks(cx, cy, r, n, color, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TWO_PI;
    const v = spd * (0.3 + Math.random() * 0.7);
    _parts.push({
      x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 1, color,
    });
  }
}
function _tickParts(dt) {
  for (let i = _parts.length - 1; i >= 0; i--) {
    const p = _parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 40 * dt; // gravity
    p.life -= dt * 1.8;
    if (p.life <= 0) _parts.splice(i, 1);
  }
}
function _drawParts(ctx) {
  for (const p of _parts) {
    ctx.globalAlpha = Math.max(0, p.life * p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// ── Shake ──
const _shakes = [];
function _triggerShake(amp, decay, t) { _shakes.push({ t0: t, amp, decay }); }
function _updateShake(t) {
  let total = 0;
  for (let i = _shakes.length - 1; i >= 0; i--) {
    const s = _shakes[i], elapsed = t - s.t0;
    if (elapsed > s.decay) { _shakes.splice(i, 1); continue; }
    total += s.amp * (1 - elapsed / s.decay);
  }
  if (total < 0.1) return { x: 0, y: 0 };
  return {
    x: Math.round((Math.random() - 0.5) * 2 * total),
    y: Math.round((Math.random() - 0.5) * 2 * total),
  };
}

// ── Easing ──
function clamp(t) { return Math.max(0, Math.min(1, t)); }
function easeOut(t) { t = clamp(t); return 1 - (1 - t) * (1 - t) * (1 - t); }
function easeOutElastic(t) {
  t = clamp(t);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TWO_PI / 3)) + 1;
}

// ═══════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════
export async function playIntro() {
  const canvas = document.createElement('canvas');
  canvas.width = CW; canvas.height = CH;
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ── "Click to start" ──
  await new Promise(resolve => {
    let frame = 0;
    const id = setInterval(() => {
      ctx.clearRect(0, 0, CW, CH);
      ctx.save(); ctx.scale(PX, PX);
      ctx.fillStyle = PAL.black; ctx.fillRect(0, 0, W, H);
      // Pulsing diamond
      const pulse = 0.6 + 0.4 * Math.sin(frame * 0.06);
      const r = 4;
      for (let y = -r; y <= r; y++) {
        const hw = r - Math.abs(y);
        for (let x = -hw; x <= hw; x++) {
          const d = r > 0 ? (Math.abs(x) + Math.abs(y)) / r : 0;
          ctx.globalAlpha = pulse;
          ctx.fillStyle = d < 0.3 ? PAL.white : d < 0.6 ? PAL.gold : PAL.darkGold;
          ctx.fillRect(CX + x, CY - 10 + y, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
      if ((frame % 80) < 55) {
        drawTextCentered(ctx, 'CLICK TO START', CX, CY + 8, PAL.midGray, 1);
      }
      ctx.restore();
      frame++;
    }, 1000 / 60);
    canvas.addEventListener('click', () => { clearInterval(id); resolve(); }, { once: true });
  });

  _initAudio();
  if (_ac?.state === 'suspended') await _ac.resume();

  // ── Skip on click ──
  let skip = false;
  const skipFn = () => { skip = true; };
  canvas.addEventListener('click', skipFn);

  // ── Phase 1: Logo (3.5s) ──
  _parts.length = 0; _shakes.length = 0;
  await _runPhase(ctx, 3.8, _renderLogo, () => skip);
  skip = false;

  // ── Phase 2: Wheel build (5.5s) ──
  _parts.length = 0; _shakes.length = 0;
  await _runPhase(ctx, 5.8, _renderBuild, () => skip);

  canvas.removeEventListener('click', skipFn);
  document.body.removeChild(canvas);
}

function _runPhase(ctx, dur, renderFn, shouldSkip) {
  return new Promise(resolve => {
    const start = performance.now();
    const sfx = new Set();
    let prevT = 0;
    (function frame(now) {
      const t = (now - start) / 1000;
      if (shouldSkip() || t >= dur) { resolve(); return; }
      const dt = Math.min(t - prevT, 0.05); prevT = t;
      _tickParts(dt);
      ctx.clearRect(0, 0, CW, CH);
      ctx.save(); ctx.scale(PX, PX);
      renderFn(ctx, t, sfx);
      ctx.restore();
      requestAnimationFrame(frame);
    })(performance.now());
  });
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1 — "JOJO'S DEN" LOGO
// ═══════════════════════════════════════════════════════════════
//
// 0.0 – 0.6   diamond materializes from center spark
// 0.6 – 1.5   "JOJO'S" types in letter by letter
// 1.5 – 1.9   "DEN" slams in (zoom + shake + bass hit)
// 1.9 – 2.3   gold double-underline draws left→right
// 2.3 – 2.8   hold (subtle particle shimmer)
// 2.8 – 3.8   fade to black

function _renderLogo(ctx, t, sfx) {
  ctx.fillStyle = PAL.black;
  ctx.fillRect(0, 0, W, H);

  const sh = _updateShake(t);
  ctx.save();
  ctx.translate(sh.x, sh.y);

  // ── Diamond gem ──
  if (t > 0.05) {
    if (!sfx.has('spark')) {
      sfx.add('spark');
      _tone(110, 1.5, 'sine', 0.07);
      _tone(220, 1.0, 'sine', 0.04);
      _tone(55, 2.0, 'sine', 0.03);
    }
    const dT = easeOut((t - 0.05) / 0.5);
    const r = Math.floor(dT * 8);
    if (r > 0) {
      for (let y = -r; y <= r; y++) {
        const hw = r - Math.abs(y);
        for (let x = -hw; x <= hw; x++) {
          const d = r > 0 ? (Math.abs(x) + Math.abs(y)) / r : 0;
          // Shading: white core → gold → darkGold edge
          ctx.fillStyle = d < 0.25 ? PAL.white : d < 0.55 ? PAL.gold : PAL.darkGold;
          ctx.fillRect(CX + x, CY - 28 + y, 1, 1);
        }
      }
      // Sparkle on top facet
      if (t > 0.3 && t < 1.0) {
        const sparkle = Math.sin(t * 12) > 0.5;
        if (sparkle) {
          ctx.fillStyle = PAL.white;
          ctx.fillRect(CX - 1, CY - 28 - r, 1, 1);
          ctx.fillRect(CX + 1, CY - 28 - r, 1, 1);
        }
      }
    }
  }

  // ── "JOJO'S" typewriter ──
  if (t > 0.6) {
    const text = "JOJO'S";
    const scale = 4;
    const charStep = (CHAR_W + 1) * scale;
    const totalW = measureText(text) * scale;
    const sx = Math.round(CX - totalW / 2);
    const sy = CY - 14;
    const shown = Math.min(text.length, Math.floor((t - 0.6) / 0.09));
    for (let i = 0; i < shown; i++) {
      if (!sfx.has('t' + i)) {
        sfx.add('t' + i);
        _tone(600 + i * 100, 0.05, 'square', 0.04);
        _tone(1200 + i * 200, 0.03, 'sine', 0.02);
      }
      drawText(ctx, text[i], sx + i * charStep, sy, PAL.gold, scale);
    }
  }

  // ── "DEN" slam ──
  if (t > 1.5) {
    if (!sfx.has('slam')) {
      sfx.add('slam');
      _tone(60, 0.6, 'square', 0.14);
      _tone(120, 0.4, 'sine', 0.10);
      _tone(180, 0.3, 'square', 0.06);
      _vib(120);
      _triggerShake(6, 0.35, t);
      _spawnSparks(CX, CY + 18, 20, PAL.gold, 60);
      _spawnSparks(CX, CY + 18, 10, PAL.white, 40);
    }
    const zoomT = clamp((t - 1.5) / 0.18);
    const zoom = 1 + 0.6 * (1 - easeOut(zoomT));
    const scale = 7;
    ctx.save();
    ctx.translate(CX, CY + 18);
    ctx.scale(zoom, zoom);
    drawTextCentered(ctx, 'DEN', 0, 0, PAL.white, scale);
    ctx.restore();
  }

  // ── Gold underlines ──
  if (t > 1.9) {
    if (!sfx.has('line')) { sfx.add('line'); _tone(1400, 0.12, 'sine', 0.02); }
    const lineW = Math.floor(easeOut((t - 1.9) / 0.3) * 140);
    ctx.fillStyle = PAL.gold;
    ctx.fillRect(CX - lineW / 2, CY + 46, lineW, 1);
    ctx.fillRect(CX - lineW / 2, CY + 49, lineW, 1);
  }

  // ── Ambient shimmer particles ──
  if (t > 2.0 && t < 3.0) {
    if (Math.random() < 0.15) {
      const px = CX + (Math.random() - 0.5) * 100;
      const py = CY + (Math.random() - 0.5) * 40;
      _parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 8, vy: -10 - Math.random() * 15, life: 0.6, color: PAL.gold });
    }
  }

  _drawParts(ctx);
  ctx.restore(); // shake

  // ── Fade out ──
  if (t > 2.8) {
    const a = clamp((t - 2.8) / 0.9);
    ctx.fillStyle = `rgba(10,10,10,${a})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — WHEEL BUILD ANIMATION
// ═══════════════════════════════════════════════════════════════
//
// 0.0 – 0.3   black screen → center spark
// 0.3 – 0.8   hub circle grows from point
// 0.8 – 2.0   40 pocket segments sweep clockwise
// 2.0 – 3.2   label ring fills (darkRed/black + numbers)
// 3.2 – 3.7   rim circle sweeps clockwise
// 3.7 – 4.5   16 hiero segments slam in from outside
// 4.5 – 5.0   "SPINFORGE" title drops in + UI ring
// 5.0 – 5.5   flash → hold → fade to game

function _renderBuild(ctx, t, sfx) {
  const sh = _updateShake(t);
  ctx.fillStyle = PAL.black;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(sh.x, sh.y);

  const cx = WCX, cy = WCY;

  // ── 1. Center spark ──
  if (t > 0.05 && t < 0.6) {
    if (!sfx.has('sp')) { sfx.add('sp'); _tone(2200, 0.08, 'sine', 0.04); _tone(1100, 0.12, 'sine', 0.03); }
    const sparkR = Math.max(0, 4 * (1 - clamp((t - 0.05) / 0.4)));
    if (sparkR > 0.5) {
      ctx.fillStyle = PAL.white;
      ctx.beginPath(); ctx.arc(cx, cy, sparkR, 0, TWO_PI); ctx.fill();
    }
  }

  // ── 2. Hub grows ──
  if (t > 0.3) {
    if (!sfx.has('hub')) {
      sfx.add('hub');
      _tone(160, 0.7, 'sine', 0.09);
      _tone(320, 0.4, 'square', 0.05);
      _tone(80, 0.5, 'sine', 0.06);
      _vib(60);
      _triggerShake(4, 0.3, t);
      _spawnSparks(cx, cy, 12, PAL.midGray, 50);
    }
    const hubT = easeOutElastic(clamp((t - 0.3) / 0.5));
    const r = Math.max(1, HUB_R * hubT);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fillStyle = PAL.black; ctx.fill();
    ctx.strokeStyle = PAL.midGray; ctx.lineWidth = 1; ctx.stroke();
  }

  // ── 3. Pocket segments fan out ──
  if (t > 0.8) {
    const elapsed = t - 0.8;
    const segsShown = Math.min(N_SEG, Math.floor(elapsed / 0.028));

    for (let i = 0; i < segsShown; i++) {
      if (!sfx.has('s' + i)) {
        sfx.add('s' + i);
        if (i % 5 === 0) _tone(350 + i * 8, 0.025, 'square', 0.02);
      }
      const a0 = INIT_A + i * SEG_ARC;
      const a1 = a0 + SEG_ARC;
      ctx.beginPath();
      ctx.arc(cx, cy, PKT_OUT, a0, a1);
      ctx.arc(cx, cy, PKT_IN, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? PAL.darkGray : PAL.black;
      ctx.fill();
      // Divider
      const dcos = Math.cos(a0), dsin = Math.sin(a0);
      ctx.beginPath();
      ctx.moveTo(cx + dcos * PKT_IN, cy + dsin * PKT_IN);
      ctx.lineTo(cx + dcos * LBL_OUT, cy + dsin * LBL_OUT);
      ctx.strokeStyle = PAL.black; ctx.lineWidth = 0.5; ctx.stroke();
    }

    // Pocket ring completion
    if (segsShown >= N_SEG && !sfx.has('pkt_done')) {
      sfx.add('pkt_done');
      _tone(250, 0.35, 'sine', 0.07);
      _tone(500, 0.2, 'square', 0.04);
      _triggerShake(5, 0.3, t);
      _vib(40);
      _spawnRingSparks(cx, cy, PKT_OUT, 16, PAL.lightGray, 30);
    }
  }

  // ── 4. Label ring (darkRed/black + numbers) ──
  if (t > 2.0) {
    const elapsed = t - 2.0;
    const segsShown = Math.min(N_SEG, Math.floor(elapsed / 0.025));

    if (!sfx.has('lbl_start')) {
      sfx.add('lbl_start');
      _tone(440, 0.25, 'sine', 0.05);
    }

    for (let i = 0; i < segsShown; i++) {
      if (!sfx.has('l' + i) && i % 5 === 0) {
        sfx.add('l' + i);
        _tone(500 + i * 6, 0.02, 'square', 0.015);
      }
      const a0 = INIT_A + i * SEG_ARC;
      const a1 = a0 + SEG_ARC;
      const mid = a0 + SEG_ARC / 2;

      // Segment fill
      ctx.beginPath();
      ctx.arc(cx, cy, LBL_OUT, a0, a1);
      ctx.arc(cx, cy, LBL_IN, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? PAL.darkRed : PAL.black;
      ctx.fill();
      ctx.strokeStyle = PAL.black; ctx.lineWidth = 0.5; ctx.stroke();

      // Number
      const numR = R * 0.425;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * numR, cy + Math.sin(mid) * numR);
      ctx.rotate(mid + Math.PI / 2);
      drawTextCentered(ctx, String(i + 1), 0, -Math.floor(CHAR_H / 2), PAL.white, 1);
      ctx.restore();
    }

    if (segsShown >= N_SEG && !sfx.has('lbl_done')) {
      sfx.add('lbl_done');
      _triggerShake(4, 0.25, t);
      _vib(30);
      _tone(600, 0.2, 'square', 0.04);
      _spawnRingSparks(cx, cy, LBL_OUT, 20, PAL.darkRed, 25);
    }
  }

  // ── 5. Rim sweep ──
  if (t > 3.2) {
    if (!sfx.has('rim')) {
      sfx.add('rim');
      _tone(900, 0.5, 'sine', 0.04);
      _tone(700, 0.4, 'square', 0.03);
    }
    const rimT = easeOut(clamp((t - 3.2) / 0.45));
    const rimArc = TWO_PI * rimT;
    ctx.beginPath();
    ctx.arc(cx, cy, RIM_R, INIT_A, INIT_A + rimArc);
    ctx.strokeStyle = PAL.darkGray; ctx.lineWidth = 1; ctx.stroke();

    if (rimT >= 1 && !sfx.has('rim_done')) {
      sfx.add('rim_done');
      _triggerShake(3, 0.2, t);
      _tone(400, 0.15, 'sine', 0.04);
    }
  }

  // ── 6. Hiero ring segments slam in from outside ──
  if (t > 3.7) {
    const elapsed = t - 3.7;
    const hieroShown = Math.min(N_HIERO, Math.floor(elapsed / 0.045));

    for (let i = 0; i < hieroShown; i++) {
      if (!sfx.has('h' + i)) {
        sfx.add('h' + i);
        _tone(180 + i * 25, 0.07, 'square', 0.035);
        if (i % 4 === 0) _vib(20);
      }

      // Slide in from outside (radial squeeze)
      const segT = easeOut(clamp((elapsed - i * 0.045) / 0.12));
      const overshoot = 40 * (1 - segT);
      const innerR = H_IN + overshoot;
      const outerR = H_OUT + overshoot;

      const a0 = HIERO_INIT + i * HIERO_ARC;
      const a1 = a0 + HIERO_ARC;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, a0, a1);
      ctx.arc(cx, cy, innerR, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? PAL.darkRed : PAL.darkGray;
      ctx.globalAlpha = segT;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // All hiero segments placed
    if (hieroShown >= N_HIERO && !sfx.has('h_done')) {
      sfx.add('h_done');
      _triggerShake(7, 0.35, t);
      _vib(100);
      _tone(100, 0.6, 'sine', 0.12);
      _tone(200, 0.4, 'square', 0.07);
      _tone(400, 0.3, 'sine', 0.04);
      _spawnRingSparks(cx, cy, H_OUT, 30, PAL.gold, 40);
      _spawnRingSparks(cx, cy, H_IN, 15, PAL.darkRed, 25);
    }
  }

  // ── Redraw hub on top (always last, so segments don't overwrite it) ──
  if (t > 0.3) {
    const hubT = t > 0.8 ? 1 : easeOutElastic(clamp((t - 0.3) / 0.5));
    const r = Math.max(1, HUB_R * hubT);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fillStyle = PAL.black; ctx.fill();
    ctx.strokeStyle = PAL.midGray; ctx.lineWidth = 1; ctx.stroke();
  }

  // ── 7. Title drops in + UI ring outline ──
  if (t > 4.5) {
    if (!sfx.has('title')) {
      sfx.add('title');
      _tone(660, 0.15, 'square', 0.07);
      setTimeout(() => _tone(880, 0.12, 'square', 0.06), 80);
      setTimeout(() => _tone(1100, 0.15, 'sine', 0.05), 160);
      setTimeout(() => _tone(1320, 0.20, 'sine', 0.04), 260);
    }
    const titleT = easeOut(clamp((t - 4.5) / 0.35));
    const titleY = -30 + titleT * 36; // slide down from off-screen
    const titleAlpha = clamp((t - 4.5) / 0.2);
    ctx.globalAlpha = titleAlpha;
    drawTextCentered(ctx, 'SPINFORGE', cx, titleY, PAL.gold, 5);
    ctx.globalAlpha = 1;

    // UI ring outline (fade in)
    const ringAlpha = clamp((t - 4.7) / 0.3);
    ctx.globalAlpha = ringAlpha;
    ctx.beginPath(); ctx.arc(cx, cy, 115, 0, TWO_PI);
    ctx.strokeStyle = PAL.midGray; ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── 8. Flash + settle ──
  if (t > 5.0 && t < 5.3) {
    const flashT = clamp((t - 5.0) / 0.25);
    const flashA = Math.sin(flashT * Math.PI) * 0.5; // peak at midpoint
    ctx.fillStyle = `rgba(232,224,208,${flashA})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Fade to black at the very end
  if (t > 5.3) {
    const a = clamp((t - 5.3) / 0.5);
    ctx.fillStyle = `rgba(10,10,10,${a})`;
    ctx.fillRect(0, 0, W, H);
  }

  _drawParts(ctx);
  ctx.restore(); // shake
}
