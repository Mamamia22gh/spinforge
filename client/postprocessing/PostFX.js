import * as THREE from 'three';

/**
 * Post-processing — bloom + vignette via EffectComposer-like approach.
 * Uses simple multi-pass render-to-texture for glow without dependencies.
 */
export function createPostFX(renderer, scene, camera) {
  const _rt1 = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType });
  const _rt2 = new THREE.WebGLRenderTarget(window.innerWidth / 4, window.innerHeight / 4, { type: THREE.HalfFloatType });

  const _quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: 0.4 },
        vignetteIntensity: { value: 0.6 },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float bloomStrength;
        uniform float vignetteIntensity;
        uniform float time;
        varying vec2 vUv;

        void main() {
          vec4 scene = texture2D(tScene, vUv);
          vec4 bloom = texture2D(tBloom, vUv);
          vec3 color = scene.rgb + bloom.rgb * bloomStrength;

          // Vignette
          float dist = distance(vUv, vec2(0.5));
          float vig = smoothstep(0.7, 0.3, dist);
          color *= mix(1.0 - vignetteIntensity, 1.0, vig);

          // Subtle color grading (warm highlights, cool shadows)
          color.r *= 1.05;
          color.b *= 0.95;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
  );
  const _ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  let _time = 0;

  return {
    resize(w, h) {
      _rt1.setSize(w, h);
      _rt2.setSize(w / 4, h / 4);
    },

    update(dt, intensity = 0) {
      _time += dt;
      _quad.material.uniforms.time.value = _time;
      _quad.material.uniforms.bloomStrength.value = 0.3 + intensity * 0.3;
    },

    render() {
      // Pass 1: Render scene to RT
      renderer.setRenderTarget(_rt1);
      renderer.clear();
      renderer.render(scene, camera);

      // Pass 2: Downsample for bloom
      renderer.setRenderTarget(_rt2);
      renderer.clear();
      renderer.render(scene, camera);

      // Pass 3: Composite
      renderer.setRenderTarget(null);
      _quad.material.uniforms.tScene.value = _rt1.texture;
      _quad.material.uniforms.tBloom.value = _rt2.texture;
      renderer.render(_quad, _ortho);
    },
  };
}
