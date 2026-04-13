/**
 * GPU post-processing — palette quantization + scanlines + vignette.
 * Replaces the CPU PaletteQuantizer + CRTFilter with a single WebGL draw call.
 * Uploads the 2D canvas as a texture, runs a fragment shader, outputs to screen.
 */

import { PAL } from './PaletteDB.js';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D uSrc;
uniform vec3 uPal[16];
uniform float uScan;
uniform float uVig;
varying vec2 vUv;

void main() {
  vec3 c = texture2D(uSrc, vUv).rgb;

  // Quantize to nearest palette color
  float best = 99999.0;
  vec3 out_c = uPal[0];
  for (int i = 0; i < 16; i++) {
    vec3 d = c - uPal[i];
    float dist = dot(d, d);
    if (dist < best) { best = dist; out_c = uPal[i]; }
  }
  c = out_c;

  // Scanlines (every other row)
  float scan = mod(gl_FragCoord.y, 2.0) < 1.0 ? 1.0 : 1.0 - uScan;
  c *= scan;

  // Vignette
  vec2 uv = vUv - 0.5;
  c *= max(0.0, 1.0 - dot(uv, uv) * 4.0 * uVig);

  gl_FragColor = vec4(c, 1.0);
}`;

export class PostFXGL {
  /**
   * @param {HTMLCanvasElement} display  visible canvas (gets WebGL context)
   * @param {object} [opts]  { scanDim, vignette }
   */
  constructor(display, opts = {}) {
    const gl = display.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL not available');
    this._gl = gl;

    // Compile + link
    const vs = this._sh(gl.VERTEX_SHADER, VERT);
    const fs = this._sh(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this._prog = prog;

    // Fullscreen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    // Texture (NEAREST = pixel art)
    this._tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Upload palette as vec3[16]
    const arr = [];
    for (const hex of Object.values(PAL)) {
      arr.push(
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
      );
    }
    gl.uniform3fv(gl.getUniformLocation(prog, 'uPal'), new Float32Array(arr));
    gl.uniform1f(gl.getUniformLocation(prog, 'uScan'), opts.scanDim ?? 0.06);
    gl.uniform1f(gl.getUniformLocation(prog, 'uVig'), opts.vignette ?? 0.25);

    gl.viewport(0, 0, display.width, display.height);
  }

  _sh(type, src) {
    const gl = this._gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  /** Upload source canvas as texture → run shader → output to display. */
  apply(sourceCanvas) {
    const gl = this._gl;
    gl.bindTexture(gl.TEXTURE_2D, this._tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
