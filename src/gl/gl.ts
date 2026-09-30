import * as THREE from 'three';
import gsap from 'gsap';
import { events, state, tickInput } from '../core/state';
import { cursor } from '../core/cursor';
import { Fluid } from './fluid';

// Everything is authored in display colour space (CSS hex values in, pixels
// out) so WebGL colours match the DOM exactly.
THREE.ColorManagement.enabled = false;

export interface Scene3D {
  /** Called every frame while visible. */
  update(dt: number, time: number): void;
  /** Render to target (null = screen). */
  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null): void;
  resize(): void;
  /** Used for the body background under the canvas. */
  background: string;
}

export const globalUniforms = {
  u_time: { value: 0 },
  u_fluid: { value: null as THREE.Texture | null },
  u_resolution: { value: new THREE.Vector2(state.w, state.h) },
};

class GL {
  canvas = document.getElementById('gl') as HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  fluid!: Fluid;
  current: Scene3D | null = null;
  private prev: Scene3D | null = null;
  private rtFrom!: THREE.WebGLRenderTarget;
  private rtTo!: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mixMat!: THREE.ShaderMaterial;
  private transitioning = false;
  private last = performance.now();
  private elapsed = 0;
  private warmRT: THREE.WebGLRenderTarget | null = null;
  private frameAvg = 16;
  private frames = 0;
  ok = true;

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      this.ok = false;
      document.documentElement.classList.add('no-webgl');
      return;
    }
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(state.dpr);
    this.renderer.setSize(state.w, state.h, false);
    this.renderer.setClearColor(0xe7e7e7, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // the only shadow-casting scene is static: scenes bake shadows on demand
    this.renderer.shadowMap.autoUpdate = false;

    this.fluid = new Fluid();
    globalUniforms.u_fluid.value = this.fluid.texture;

    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const opts = { depthBuffer: true } as THREE.RenderTargetOptions;
    this.rtFrom = new THREE.WebGLRenderTarget(size.x, size.y, opts);
    this.rtTo = new THREE.WebGLRenderTarget(size.x, size.y, opts);

    this.mixMat = new THREE.ShaderMaterial({
      uniforms: {
        tFrom: { value: null },
        tTo: { value: null },
        uProgress: { value: 0 },
        uAspect: { value: state.w / state.h },
        u_time: globalUniforms.u_time,
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D tFrom, tTo;
        uniform float uProgress, uAspect, u_time;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3. - 2. * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= .5; } return v; }
        void main() {
          vec2 uv = vUv;
          vec2 c = (uv - .5) * vec2(uAspect, 1.);
          float n = fbm(uv * 3.5 + u_time * .15);
          float d = length(c) * .9 + n * .45;
          float edge = uProgress * 1.75 - d;
          float m = smoothstep(0., .08, edge);
          float band = smoothstep(-.04, .08, edge) * (1. - smoothstep(.08, .28, edge));
          vec2 dir = normalize(c + 1e-4);
          vec2 uvFrom = (uv - .5) * (1. - .12 * uProgress) + .5 + dir * band * .03;
          vec2 uvTo = (uv - .5) * (1. + .1 * (1. - uProgress)) + .5 - dir * band * .05;
          vec4 a = texture2D(tFrom, uvFrom);
          vec4 b = texture2D(tTo, uvTo);
          vec4 col = mix(a, b, m);
          col.rgb += band * .12;
          gl_FragColor = col;
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mixMat));

    events.on('resize', () => this.resize());
    // One clock for everything: smooth scroll (registered with priority by
    // pages), DOM animations and WebGL all advance in the same frame, so 3D
    // objects never drift a frame behind the page.
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.add(this.tick);
  }

  resize() {
    if (!this.ok) return;
    this.renderer.setPixelRatio(state.dpr);
    this.renderer.setSize(state.w, state.h, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rtFrom.setSize(size.x, size.y);
    this.rtTo.setSize(size.x, size.y);
    this.mixMat.uniforms.uAspect.value = state.w / state.h;
    globalUniforms.u_resolution.value.set(state.w, state.h);
    this.fluid.resize();
    this.current?.resize();
    if (this.prev && this.prev !== this.current) this.prev.resize();
  }

  /** Swap to a new scene, with a noise-dissolve transition if one is already showing. */
  show(next: Scene3D, duration = 1.6): Promise<void> {
    document.body.style.backgroundColor = next.background;
    if (!this.ok || next === this.current) return Promise.resolve();
    next.resize();
    if (!this.current || duration === 0) {
      this.current = next;
      return Promise.resolve();
    }
    this.prev = this.current;
    this.current = next;
    this.transitioning = true;
    const p = this.mixMat.uniforms.uProgress;
    p.value = 0;
    return new Promise((resolve) => {
      gsap.to(p, {
        value: 1,
        duration,
        ease: 'power2.inOut',
        overwrite: true,
        onComplete: () => {
          this.transitioning = false;
          this.prev = null;
          resolve();
        },
      });
    });
  }

  /**
   * Renders a scene once off-screen so its shaders compile and textures
   * upload before the visitor navigates to it (no hitch mid-transition).
   */
  prewarm(scene: Scene3D) {
    if (!this.ok || scene === this.current || scene === this.prev) return;
    this.warmRT ??= new THREE.WebGLRenderTarget(64, 64);
    scene.resize();
    scene.update(0.016, this.elapsed);
    scene.render(this.renderer, this.warmRT);
    this.renderer.setRenderTarget(null);
  }

  /** Drops the pixel ratio if the device can't keep up (never raises it). */
  private adapt(frameMs: number) {
    this.frameAvg = this.frameAvg * 0.95 + frameMs * 0.05;
    this.frames++;
    if (this.frames < 120 || this.transitioning || document.hidden) return;
    if (this.frameAvg > 24 && state.dpr > 1) {
      state.dpr = Math.max(1, state.dpr - 0.25);
      this.frames = 0;
      this.frameAvg = 16;
      events.emit('resize');
    }
  }

  private tick = () => {
    const now = performance.now();
    const raw = now - this.last;
    const dt = Math.min(0.05, raw / 1000);
    this.last = now;
    if (raw < 200) this.adapt(raw);
    this.elapsed += dt;
    globalUniforms.u_time.value = this.elapsed;

    tickInput(dt);
    cursor.update(dt);
    events.emit('tick', { dt, time: this.elapsed });

    if (!this.ok) return;
    this.fluid.update(this.renderer);
    globalUniforms.u_fluid.value = this.fluid.texture;

    if (this.transitioning && this.prev && this.current) {
      this.prev.update(dt, this.elapsed);
      this.current.update(dt, this.elapsed);
      this.prev.render(this.renderer, this.rtFrom);
      this.current.render(this.renderer, this.rtTo);
      this.mixMat.uniforms.tFrom.value = this.rtFrom.texture;
      this.mixMat.uniforms.tTo.value = this.rtTo.texture;
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCam);
    } else if (this.current) {
      this.current.update(dt, this.elapsed);
      this.current.render(this.renderer, null);
    } else {
      this.renderer.setRenderTarget(null);
      this.renderer.clear();
    }
  };
}

export const gl = new GL();

/**
 * A pixel-space perspective camera: at z = 0, one world unit equals one CSS pixel.
 */
export const pixelCamera = (distance = 1000, far = 12000) => {
  const cam = new THREE.PerspectiveCamera(45, state.w / state.h, 1, far);
  const fit = () => {
    cam.aspect = state.w / state.h;
    cam.fov = (2 * Math.atan(state.h / 2 / distance) * 180) / Math.PI;
    cam.position.z = distance;
    cam.updateProjectionMatrix();
  };
  fit();
  return { cam, fit };
};
