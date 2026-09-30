import * as THREE from 'three';
import { state } from '../core/state';

/**
 * Lightweight mouse "fluid": a self-advecting velocity field that is splatted
 * by pointer movement and slowly dissipates. Scene shaders sample its RG
 * channels to warp images and text.
 */
export class Fluid {
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private size = new THREE.Vector2(192, 108);

  constructor() {
    const opts: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    this.rtA = new THREE.WebGLRenderTarget(this.size.x, this.size.y, opts);
    this.rtB = new THREE.WebGLRenderTarget(this.size.x, this.size.y, opts);
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tPrev: { value: null },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uForce: { value: new THREE.Vector2() },
        uRadius: { value: 0.0022 },
        uDissipation: { value: 0.965 },
        uTexel: { value: new THREE.Vector2(1 / this.size.x, 1 / this.size.y) },
        uAspect: { value: 16 / 9 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tPrev;
        uniform vec2 uMouse, uForce, uTexel;
        uniform float uRadius, uDissipation, uAspect;
        void main() {
          vec2 vel = texture2D(tPrev, vUv).xy;
          vec2 back = vUv - vel * uTexel * 0.35;
          vec2 v = texture2D(tPrev, back).xy;
          // light diffusion
          v += texture2D(tPrev, back + vec2(uTexel.x, 0.)).xy;
          v += texture2D(tPrev, back - vec2(uTexel.x, 0.)).xy;
          v += texture2D(tPrev, back + vec2(0., uTexel.y)).xy;
          v += texture2D(tPrev, back - vec2(0., uTexel.y)).xy;
          v = v / 5.0 * uDissipation;
          vec2 d = vUv - uMouse;
          d.x *= uAspect;
          float s = exp(-dot(d, d) / uRadius);
          v += uForce * s;
          v = clamp(v, -8.0, 8.0);
          gl_FragColor = vec4(v, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    this.resize();
  }

  get texture() {
    return this.rtA.texture;
  }

  resize() {
    const w = 192;
    const h = Math.max(64, Math.round((w * state.h) / state.w));
    this.size.set(w, h);
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.mat.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.mat.uniforms.uAspect.value = state.w / state.h;
  }

  update(renderer: THREE.WebGLRenderer) {
    const u = this.mat.uniforms;
    u.uMouse.value.set(state.mouse.x / state.w, 1 - state.mouse.y / state.h);
    const k = state.reducedMotion ? 0 : 0.9;
    u.uForce.value.set(
      THREE.MathUtils.clamp(state.mouse.vx * k, -40, 40),
      THREE.MathUtils.clamp(-state.mouse.vy * k, -40, 40),
    );
    u.tPrev.value = this.rtA.texture;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.rtB);
    renderer.render(this.scene, this.cam);
    renderer.setRenderTarget(prev);
    [this.rtA, this.rtB] = [this.rtB, this.rtA];
  }
}
