import * as THREE from 'three';
import gsap from 'gsap';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Scene3D, globalUniforms } from '../gl';

import { damp, events, state } from '../../core/state';

/**
 * Index / Contact scene: a surreal blush plaster room half-flooded with
 * rippling reflective water. Arches on the left open onto lavender hills,
 * windows show the sky, and the NUUKE logo floats above the stairs.
 */

const FOG = '#ecd3ce';
const HEAD_W = 2400;
const HEAD_H = 530;
const WALL = '#f4d6ce';

const noiseGlsl = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
`;

const logoVert = /* glsl */ `
  uniform float u_time;
  uniform float u_progress;
  varying vec2 vUv;
  varying vec2 vScreen;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 6.0 + u_time * 0.8) * 0.03 * u_progress;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vScreen = clip.xy / clip.w * 0.5 + 0.5;
    gl_Position = clip;
  }
`;

const logoFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D u_tex;
  uniform sampler2D u_fluid;
  uniform float u_time;
  uniform float u_progress;
  uniform float u_opacity;
  uniform vec3 u_color;
  varying vec2 vUv;
  varying vec2 vScreen;
  ${noiseGlsl}
  void main() {
    vec2 fl = texture2D(u_fluid, vScreen).xy;
    vec2 off = fl * vec2(0.0016, 0.0055);
    vec2 uv = vUv - off;
    float n = noise(vUv * vec2(9.0, 3.0) + u_time * 0.3);
    float edge = u_progress * 1.5 - (vUv.x * 0.8 + (1.0 - vUv.y) * 0.2 + n * 0.3);
    float reveal = smoothstep(0.0, 0.12, edge);
    uv.y += (1.0 - reveal) * 0.25;
    float aR = texture2D(u_tex, uv + off * 1.6).a;
    float aG = texture2D(u_tex, uv).a;
    float aB = texture2D(u_tex, uv - off * 1.6).a;
    float a = max(aR, max(aG, aB)) * reveal * u_opacity;
    vec3 col = u_color + vec3(aR - aG, (aR + aB) * 0.5 - aG, aB - aG) * 0.9;
    gl_FragColor = vec4(col, a);
  }
`;

const plasterTexture = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 512, 512);
  // soft blotches
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 30 + Math.random() * 110;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = Math.random() * 0.05;
    grd.addColorStop(0, `rgba(150,110,100,${a})`);
    grd.addColorStop(1, 'rgba(150,110,100,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
  }
  // fine grain
  const img = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 16;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export class HomeScene implements Scene3D {
  background = FOG;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(38, state.w / state.h, 0.1, 400);
  private logo!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private water!: Reflector;
  private particles!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private rt: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMat: THREE.ShaderMaterial;
  /** 0 = home, 1 = contact */
  private mode = { v: 0 };
  private intro = { v: 1 };
  private look = new THREE.Vector3();
  private shots: { home: Shot; contact: Shot; intro: Shot } = {
    home: { pos: new THREE.Vector3(0.9, 2.35, 12.5), look: new THREE.Vector3(0.2, 3.05, -8) },
    contact: { pos: new THREE.Vector3(3.2, 2.1, 6.5), look: new THREE.Vector3(7.2, 3.4, -8) },
    intro: { pos: new THREE.Vector3(-0.6, 4.2, 19), look: new THREE.Vector3(0.6, 3.6, -8) },
  };
  private tmpPos = new THREE.Vector3();
  private tmpLook = new THREE.Vector3();
  private anchor = new THREE.Vector3();
  introPlayed = false;

  constructor() {
    this.scene.background = new THREE.Color(FOG);
    this.scene.fog = new THREE.Fog(FOG, 30, 150);
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });
    this.postMat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, uAspect: { value: 1 }, u_time: globalUniforms.u_time },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tScene;
        uniform float uAspect, u_time;
        varying vec2 vUv;
        void main() {
          vec2 c = vUv - 0.5;
          float r = length(c * vec2(uAspect, 1.0));
          vec2 dir = normalize(c + 1e-5);
          float ca = 0.0035 * smoothstep(0.2, 0.9, r);
          vec3 col;
          col.r = texture2D(tScene, vUv + dir * ca).r;
          col.g = texture2D(tScene, vUv).g;
          col.b = texture2D(tScene, vUv - dir * ca * 1.4).b;
          // soft warm grade + vignette
          col = mix(col, col * vec3(1.03, 0.99, 1.0), 0.6);
          col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.28;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));

    this.buildLights();
    this.buildSky();
    this.buildRoom();
    this.buildHills();
    this.buildRocks();
    this.buildWater();
    this.buildParticles();
    this.buildLogo();
    this.resize();
    events.on('resize', () => this.resize());
    if (import.meta.env.DEV) (window as any).__home = this;
  }

  // ---------------------------------------------------------------- build
  private buildLights() {
    const hemi = new THREE.HemisphereLight('#efe6ff', '#f5cfc5', 2.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff2e8', 1.15);
    sun.position.set(-15, 24, 6);
    sun.target.position.set(4, 0, -8);
    sun.castShadow = true;
    const s = state.w < 768 ? 1024 : 2048;
    sun.shadow.mapSize.set(s, s);
    const sc = sun.shadow.camera;
    sc.left = -24;
    sc.right = 24;
    sc.top = 24;
    sc.bottom = -24;
    sc.near = 1;
    sc.far = 80;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 6;
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight('#ffe2dc', 0.35);
    fill.position.set(10, 6, 14);
    this.scene.add(fill);
  }

  private buildSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(220, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { u_time: globalUniforms.u_time },
        vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float u_time;
          varying vec3 vDir;
          ${noiseGlsl}
          void main() {
            float h = vDir.y;
            vec3 horizon = vec3(0.96, 0.84, 0.87);
            vec3 mid = vec3(0.80, 0.80, 0.95);
            vec3 top = vec3(0.55, 0.69, 0.93);
            vec3 col = mix(horizon, mid, smoothstep(-0.02, 0.18, h));
            col = mix(col, top, smoothstep(0.18, 0.62, h));
            // wispy clouds
            vec2 p = vDir.xz / max(h + 0.25, 0.1) * 2.2 + vec2(u_time * 0.01, 0.0);
            float cl = smoothstep(0.55, 0.85, fbm(p * 0.8)) * smoothstep(0.02, 0.3, h) * 0.35;
            col = mix(col, vec3(1.0, 0.97, 0.98), cl);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    );
    this.scene.add(sky);
  }

  private buildRoom() {
    const tex = plasterTexture();
    const wallMat = (repeat: number, color = WALL) => {
      const t = tex.clone();
      t.needsUpdate = true;
      t.repeat.set(repeat, repeat);
      return new THREE.MeshStandardMaterial({ color, map: t, roughness: 0.96, metalness: 0 });
    };
    const extrude = (shape: THREE.Shape, depth: number) =>
      new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };

    // Back wall (z = -8) with a tall window and a small square window.
    const back = new THREE.Shape();
    back.moveTo(-7.5, -2);
    back.lineTo(22, -2);
    back.lineTo(22, 18);
    back.lineTo(-7.5, 18);
    back.closePath();
    const win = (x0: number, y0: number, x1: number, y1: number) => {
      const h = new THREE.Path();
      h.moveTo(x0, y0);
      h.lineTo(x0, y1);
      h.lineTo(x1, y1);
      h.lineTo(x1, y0);
      h.closePath();
      back.holes.push(h);
    };
    win(6.4, 5.4, 7.9, 12.2);
    win(3.3, 4.6, 4.3, 5.8);
    const backMesh = mesh(extrude(back, 1.1), wallMat(0.06));
    backMesh.position.z = -9.1;

    // Left wall (x = -6) with a colonnade of arches opening to the outside.
    const left = new THREE.Shape();
    left.moveTo(-9.1, -2);
    left.lineTo(20, -2);
    left.lineTo(20, 18);
    left.lineTo(-9.1, 18);
    left.closePath();
    const archW = 1.3;
    const archH = 4.3;
    [-4.8, -0.2, 4.4, 9].forEach((zc) => {
      const h = new THREE.Path();
      h.moveTo(zc - archW, -1.2);
      h.lineTo(zc - archW, archH);
      h.absarc(zc, archH, archW, Math.PI, 0, true);
      h.lineTo(zc + archW, -1.2);
      h.closePath();
      left.holes.push(h);
    });
    const leftMesh = mesh(extrude(left, 0.9), wallMat(0.06, '#f6dad2'));
    leftMesh.rotation.y = -Math.PI / 2;
    leftMesh.position.z = 8;
    const hinge = new THREE.Group();
    hinge.position.set(-4.6, 0, -8);
    hinge.rotation.y = -0.32;
    hinge.add(leftMesh);
    this.scene.add(hinge);

    // Stairs rising out of the water up to a platform.
    const stairMat = wallMat(0.2, '#f6e1da');
    const steps = 5;
    const rise = 0.34;
    const tread = 0.52;
    const x0 = -2.4;
    const x1 = 2.0;
    for (let i = 0; i < steps; i++) {
      const top = -0.25 + (i + 1) * rise;
      const front = -2.7 - i * tread;
      const depth = front - -8;
      const g = new THREE.BoxGeometry(x1 - x0, top + 2, depth);
      const m = mesh(g, stairMat);
      m.position.set((x0 + x1) / 2, top - (top + 2) / 2, front - depth / 2);
    }
    const platformTop = -0.25 + steps * rise;
    // ledge running along the back wall to the right
    const ledge = mesh(new THREE.BoxGeometry(20, platformTop + 2, 2.4), wallMat(0.08, '#f3d9d1'));
    ledge.position.set(x1 + 10, platformTop - (platformTop + 2) / 2, -8 + 1.2);
    // low parapet on the ledge
    const parapet = mesh(new THREE.BoxGeometry(20, 0.9, 0.35), wallMat(0.1, '#f3d9d1'));
    parapet.position.set(x1 + 10, platformTop + 0.45, -8 + 2.2);
  }

  private buildHills() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { u_time: globalUniforms.u_time, fogColor: { value: new THREE.Color(FOG) } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vNormal;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float u_time;
        uniform vec3 fogColor;
        varying vec3 vWorld;
        varying vec3 vNormal;
        ${noiseGlsl}
        void main() {
          // vertical grass streaks
          float g = fbm(vec2(vWorld.x * 2.4 + vWorld.z * 2.4, vWorld.y * 0.35) + vec2(sin(u_time * 0.4) * 0.05, 0.0));
          float streak = fbm(vec2((vWorld.x + vWorld.z) * 9.0, vWorld.y * 1.2));
          vec3 lav = vec3(0.82, 0.70, 0.90);
          vec3 deep = vec3(0.66, 0.55, 0.77);
          vec3 tip = vec3(0.95, 0.86, 0.96);
          vec3 col = mix(deep, lav, g);
          col = mix(col, tip, smoothstep(0.55, 0.8, streak) * 0.6);
          float light = 0.75 + 0.35 * max(dot(vNormal, normalize(vec3(-0.5, 0.8, 0.4))), 0.0);
          col *= light;
          float d = length(vWorld - cameraPosition);
          col = mix(col, fogColor, smoothstep(25.0, 110.0, d) * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const hills: [number, number, number, number, number, number][] = [
      // x, y, z, sx, sy, sz
      [-26, -3.2, -16, 22, 7.5, 16],
      [-36, -2.4, 0, 20, 7, 18],
      [-24, -3.6, 14, 16, 6, 12],
      [-52, -1.5, -30, 34, 12, 24],
    ];
    hills.forEach(([x, y, z, sx, sy, sz]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      this.scene.add(m);
    });
  }

  private buildRocks() {
    const rockGeo = (seed: number) => {
      const g0 = new THREE.IcosahedronGeometry(1, 20);
      g0.deleteAttribute('normal');
      g0.deleteAttribute('uv');
      const g = mergeVertices(g0);
      const p = g.attributes.position as THREE.BufferAttribute;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n =
          Math.sin(v.x * 3.1 + seed) * 0.06 +
          Math.sin(v.y * 4.3 + seed * 2) * 0.05 +
          Math.sin(v.z * 5.7 + seed * 3) * 0.04 +
          Math.sin((v.x + v.y) * 11 + seed) * 0.015;
        v.multiplyScalar(1 + n);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    };
    const mat = new THREE.MeshStandardMaterial({ color: '#d8c0b4', roughness: 1 });
    (
      [
        [6.4, 0.05, -3.4, 1.5, 1.0, 1.25, 1],
        [11.2, -0.15, 0.6, 1.9, 1.25, 1.6, 2],
      ] as const
    ).forEach(([x, y, z, sx, sy, sz, seed]) => {
      const m = new THREE.Mesh(rockGeo(seed), mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.rotation.y = seed;
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    });
  }

  private buildWater() {
    const res = state.w < 768 ? 0.5 : 0.6;
    this.water = new Reflector(new THREE.PlaneGeometry(260, 260), {
      clipBias: 0.003,
      textureWidth: Math.round(state.w * state.dpr * res),
      textureHeight: Math.round(state.h * state.dpr * res),
      color: new THREE.Color('#d7c9e2'),
      shader: {
        name: 'NuukeWater',
        uniforms: {
          color: { value: null },
          tDiffuse: { value: null },
          textureMatrix: { value: null },
        },
        vertexShader: /* glsl */ `
          uniform mat4 textureMatrix;
          varying vec4 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = textureMatrix * vec4(position, 1.0);
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform vec3 color;
          uniform sampler2D tDiffuse;
          uniform float u_time;
          uniform vec3 u_fog;
          varying vec4 vUv;
          varying vec3 vWorld;
          ${noiseGlsl}
          void main() {
            vec2 p = vWorld.xz;
            float t = u_time;
            float swell = sin(p.x * 0.6 + t * 0.5 + sin(p.y * 0.4 + t * 0.3) * 1.2);
            float ripple = sin(p.y * 5.5 - t * 1.4 + sin(p.x * 1.1 + t * 0.4) * 2.2);
            float fine = sin(p.y * 13.0 + p.x * 0.8 - t * 2.1);
            float n = fbm(p * 0.35 + vec2(t * 0.05, -t * 0.03));
            vec2 dist = vec2(
              ripple * 0.0035 + (n - 0.5) * 0.006,
              ripple * 0.009 + fine * 0.004 + swell * 0.004 + (n - 0.5) * 0.012
            );
            vec4 uv = vUv;
            uv.xy += dist * uv.w;
            vec3 refl = texture2DProj(tDiffuse, uv).rgb;
            vec3 col = mix(refl, color, 0.16);
            col *= 0.97 + ripple * 0.025;
            // iridescent sheen streaks
            float sheen = smoothstep(0.82, 1.0, sin(p.x * 0.55 + p.y * 0.25 + n * 5.0 + t * 0.25));
            col += sheen * vec3(0.10, 0.12, 0.2);
            float d = length(vWorld - cameraPosition);
            col = mix(col, u_fog, smoothstep(30.0, 150.0, d));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      },
    });
    const u = (this.water.material as THREE.ShaderMaterial).uniforms;
    u.u_time = globalUniforms.u_time;
    u.u_fog = { value: new THREE.Color(FOG) };
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0;
    this.scene.add(this.water);
  }

  private buildParticles() {
    const count = state.w < 768 ? 180 : 360;
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -6 + Math.random() * 20;
      pos[i * 3 + 1] = 0.3 + Math.random() * 9;
      pos[i * 3 + 2] = -8 + Math.random() * 18;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { u_time: globalUniforms.u_time, u_scale: { value: state.h * state.dpr } },
      vertexShader: /* glsl */ `
        uniform float u_time, u_scale;
        attribute float aSeed;
        varying float vA;
        void main() {
          vec3 p = position;
          float t = u_time * (0.05 + aSeed * 0.08);
          p.y += mod(t * 2.0 + aSeed * 9.0, 9.0) - 4.5 + 0.0;
          p.x += sin(t * 3.0 + aSeed * 20.0) * 0.6;
          p.z += cos(t * 2.0 + aSeed * 13.0) * 0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.025 + aSeed * 0.035) * u_scale / -mv.z;
          vA = 0.35 + 0.5 * sin(u_time * (0.5 + aSeed) + aSeed * 30.0) * 0.5 + 0.25;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA;
          gl_FragColor = vec4(1.0, 0.98, 0.97, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.particles = new THREE.Points(g, m);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
  }

  /** "Great products / don't sell themselves" — serif + sans, like the reference headline. */
  private headlineTexture() {
    const c = document.createElement('canvas');
    c.width = HEAD_W;
    c.height = HEAD_H;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 8;
    const draw = () => {
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      const big = 190;
      const cx = c.width / 2;
      // small uppercase intro line
      g.font = `500 30px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif`;
      (g as any).letterSpacing = '1px';
      g.fillText('A SOCIAL-FIRST MARKETING STUDIO', cx, 70);
      // serif line
      g.font = `400 ${big}px "Playfair Display", Georgia, serif`;
      (g as any).letterSpacing = '-7px';
      g.fillText('Great products', cx, 70 + 40 + big * 0.86);
      // sans line
      g.font = `400 ${big}px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif`;
      (g as any).letterSpacing = '-6px';
      g.fillText('don’t sell themselves', cx, 70 + 40 + big * 0.86 + big * 0.98);
      tex.needsUpdate = true;
    };
    draw();
    Promise.all([
      document.fonts.load('400 190px "Playfair Display"'),
      document.fonts.load('400 190px "Inter Tight Variable"'),
    ]).then(draw);
    return tex;
  }

  private buildLogo() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: logoVert,
      fragmentShader: logoFrag,
      uniforms: {
        u_tex: { value: this.headlineTexture() },
        u_fluid: globalUniforms.u_fluid,
        u_time: globalUniforms.u_time,
        u_progress: { value: 0 },
        u_opacity: { value: 1 },
        u_color: { value: new THREE.Color('#353535') },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.logo = new THREE.Mesh(new THREE.PlaneGeometry(1, HEAD_H / HEAD_W, 48, 16), mat);
    this.logo.renderOrder = 10;
    this.logo.position.set(-0.2, 3.35, -4.4);
    this.scene.add(this.logo);
  }

  // ---------------------------------------------------------------- api
  playIntro(delay = 0) {
    this.introPlayed = true;
    const u = this.logo.material.uniforms;
    u.u_progress.value = 0;
    gsap.to(u.u_progress, { value: 1, duration: 3.2, ease: 'power3.out', delay: delay + 0.6 });
    this.intro.v = 1;
    gsap.to(this.intro, { v: 0, duration: 3.4, ease: 'power3.inOut', delay });
  }

  setMode(m: 'home' | 'contact', animate = true) {
    const v = m === 'home' ? 0 : 1;
    if (!animate) {
      this.mode.v = v;
      return;
    }
    gsap.to(this.mode, { v, duration: 2.4, ease: 'expo.inOut', overwrite: true });
  }

  /** Screen position (CSS px) just below the floating headline, for the CTA pill. */
  ctaPosition() {
    this.anchor.set(this.logo.position.x, this.logo.position.y - this.logo.scale.y * (HEAD_H / HEAD_W) * 0.5 - 0.45, this.logo.position.z);
    this.anchor.project(this.cam);
    return { x: (this.anchor.x * 0.5 + 0.5) * state.w, y: (-this.anchor.y * 0.5 + 0.5) * state.h };
  }

  // ------------------------------------------------------------- update
  update(dt: number) {
    const { home, contact, intro } = this.shots;
    const mv = this.mode.v;
    const iv = this.intro.v;
    this.tmpPos.lerpVectors(home.pos, contact.pos, mv).lerp(intro.pos, iv);
    this.tmpLook.lerpVectors(home.look, contact.look, mv).lerp(intro.look, iv);

    // look around with the pointer
    const nx = state.smooth.nx;
    const ny = state.smooth.ny;
    this.tmpPos.x += nx * 0.9;
    this.tmpPos.y += ny * 0.35;
    this.tmpLook.x += nx * 2.6;
    this.tmpLook.y += ny * 1.3;
    // subtle push-in while the menu is open
    if (state.menuOpen) this.tmpPos.lerp(this.tmpLook, 0.1);

    const cam = this.cam;
    const k = 1 - Math.exp(-4 * dt);
    cam.position.lerp(this.tmpPos, k);
    this.look.lerp(this.tmpLook, k);
    cam.lookAt(this.look);

    // logo: gentle float
    const t = globalUniforms.u_time.value;
    this.logo.position.y = 3.35 + Math.sin(t * 0.6) * 0.06;
    this.logo.rotation.y = damp(this.logo.rotation.y, nx * 0.12, 3, dt);
    this.logo.rotation.x = damp(this.logo.rotation.x, -ny * 0.06, 3, dt);
    this.logo.material.uniforms.u_opacity.value = 1 - Math.min(1, mv * 1.6);
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.cam);
    this.postMat.uniforms.tScene.value = this.rt.texture;
    renderer.setRenderTarget(target);
    renderer.render(this.postScene, this.postCam);
  }

  resize() {
    this.cam.aspect = state.w / state.h;
    // keep the composition on portrait screens by widening the lens
    this.cam.fov = state.w / state.h < 1 ? 58 : 38;
    this.cam.updateProjectionMatrix();
    this.rt.setSize(state.w * state.dpr, state.h * state.dpr);
    this.postMat.uniforms.uAspect.value = state.w / state.h;
    this.particles.material.uniforms.u_scale.value = state.h * state.dpr;
    const res = state.w < 768 ? 0.5 : 0.6;
    this.water.getRenderTarget().setSize(Math.round(state.w * state.dpr * res), Math.round(state.h * state.dpr * res));
    // scale the logo so it reads well at every aspect
    const s = state.w / state.h < 1 ? 5.2 : 7.4;
    this.logo.scale.set(s, s, 1);
  }
}
