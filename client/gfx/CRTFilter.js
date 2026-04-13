/**
 * CRT post-processing — barrel distortion, chromatic aberration,
 * scanlines, vignette.  All lookup tables pre-computed once so the
 * per-frame loop is branchless and fast at 480×270.
 */

const DEFAULTS = {
  bend:     0.03,   // barrel distortion (0 = none, 0.1 = strong CRT bulge)
  chroma:   1,      // chromatic aberration offset in pixels
  scanDim:  0.06,   // scanline darkening (0 = none, 0.3 = heavy)
  vignette: 0.25,   // vignette corner darkening
};

export class CRTFilter {
  /**
   * @param {number} w  canvas width
   * @param {number} h  canvas height
   * @param {object} [opts]  override any of DEFAULTS
   */
  constructor(w, h, opts) {
    this.bend     = opts?.bend     ?? DEFAULTS.bend;
    this.chroma   = opts?.chroma   ?? DEFAULTS.chroma;
    this.scanDim  = opts?.scanDim  ?? DEFAULTS.scanDim;
    this.vignette = opts?.vignette ?? DEFAULTS.vignette;

    this._w = 0;
    this._h = 0;
    this._rL = null;   // Uint32 LUT — source byte-offset for R channel
    this._gL = null;   // same for G
    this._bL = null;   // same for B
    this._mul = null;  // Float32 combined vignette × scanline multiplier
    this._out = null;  // ImageData output buffer

    this.resize(w, h);
  }

  /** Rebuild LUTs when canvas size changes (rare). */
  resize(w, h) {
    this._w = w;
    this._h = h;
    const n = w * h;

    this._rL  = new Uint32Array(n);
    this._gL  = new Uint32Array(n);
    this._bL  = new Uint32Array(n);
    this._mul = new Float32Array(n);
    this._out = null; // lazy-create with ctx

    const cx = w * 0.5, cy = h * 0.5;
    const clX = v => Math.max(0, Math.min(w - 1, (v + 0.5) | 0));
    const clY = v => Math.max(0, Math.min(h - 1, (v + 0.5) | 0));

    const { bend, chroma, scanDim, vignette } = this;

    for (let y = 0; y < h; y++) {
      const ny   = (y - cy) / cy;            // -1 … +1
      const scan = (y & 1) ? 1 - scanDim : 1;

      for (let x = 0; x < w; x++) {
        const nx  = (x - cx) / cx;           // -1 … +1
        const r2  = nx * nx + ny * ny;
        const bar = 1 + bend * r2;           // barrel factor

        // Distorted source position (G channel = center)
        const gx = cx + nx * bar * cx;
        const gy = cy + ny * bar * cy;

        // R/B offset for chromatic aberration
        const rx = gx + chroma;
        const bx = gx - chroma;

        // In-bounds check on the G position — out-of-bounds → black
        const inB = gx >= 0 && gx < w && gy >= 0 && gy < h;
        const v   = inB ? Math.max(0, 1 - r2 * vignette) * scan : 0;

        const pi = y * w + x;
        this._rL[pi]  = (clY(gy) * w + clX(rx)) << 2;
        this._gL[pi]  = (clY(gy) * w + clX(gx)) << 2;
        this._bL[pi]  = (clY(gy) * w + clX(bx)) << 2;
        this._mul[pi] = v;
      }
    }
  }

  /** Apply the CRT filter in-place on the given 2D context. */
  apply(ctx) {
    const w = this._w, h = this._h;
    if (!this._out) this._out = ctx.createImageData(w, h);

    const src = ctx.getImageData(0, 0, w, h).data;
    const dst = this._out.data;
    const rL = this._rL, gL = this._gL, bL = this._bL, mul = this._mul;
    const n = w * h;

    for (let pi = 0; pi < n; pi++) {
      const m  = mul[pi];
      const oi = pi << 2;
      dst[oi]     = (src[rL[pi]]     * m) | 0;
      dst[oi + 1] = (src[gL[pi] + 1] * m) | 0;
      dst[oi + 2] = (src[bL[pi] + 2] * m) | 0;
      dst[oi + 3] = 255;
    }

    ctx.putImageData(this._out, 0, 0);
  }
}
