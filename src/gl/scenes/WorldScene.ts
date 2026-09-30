import * as THREE from 'three';
import gsap from 'gsap';
import { Scene3D, globalUniforms, pixelCamera } from '../gl';
import { blankTexture, loadTexture, logoTexture } from '../assets';
import { PROJECTS, Project } from '../../data/projects';
import { damp, events, state } from '../../core/state';

const BG = '#050505';

export interface WorldMedia {
  url: string;
  portrait: boolean;
  project: Project;
  kind: 'campaign' | 'creator';
  index: number;
}

const itemVert = /* glsl */ `
  uniform sampler2D u_fluid;
  uniform float u_curve;
  varying vec2 vUv;
  varying float vDepth;
  varying vec2 vFluid;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    // bend the field away from the camera towards the edges, like a globe
    float r2 = dot(world.xy, world.xy);
    world.z -= r2 * u_curve;
    vec4 clip = projectionMatrix * viewMatrix * world;
    vec2 screen = clip.xy / clip.w * 0.5 + 0.5;
    vec2 fl = texture2D(u_fluid, screen).xy;
    world.xy += fl * 1.2;
    vFluid = fl;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const itemFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D u_tex;
  uniform vec2 u_imageSize;
  uniform vec2 u_meshSize;
  uniform float u_opacity;
  uniform float u_hover;
  uniform float u_focus;
  varying vec2 vUv;
  varying float vDepth;
  varying vec2 vFluid;
  vec2 coverUv(vec2 uv, vec2 mesh, vec2 img) {
    float rm = mesh.x / mesh.y, ri = img.x / img.y;
    vec2 s = rm < ri ? vec2(rm / ri, 1.0) : vec2(1.0, ri / rm);
    return (uv - 0.5) * s + 0.5;
  }
  void main() {
    vec2 uv = coverUv(vUv, u_meshSize, u_imageSize);
    uv = (uv - 0.5) / (1.0 + u_hover * 0.06) + 0.5;
    vec4 col = texture2D(u_tex, uv);
    float lum = dot(col.rgb, vec3(0.299, 0.587, 0.114));
    // slightly desaturated at rest, full colour on hover / focus
    col.rgb = mix(vec3(lum), col.rgb, 0.65 + 0.35 * max(u_hover, u_focus));
    col.rgb += length(vFluid) * 0.01;
    float fog = smoothstep(1300.0, 3000.0, vDepth);
    col.rgb = mix(col.rgb, vec3(0.02), fog);
    gl_FragColor = vec4(col.rgb, u_opacity);
  }
`;

export interface WorldItem {
  media: WorldMedia;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  base: THREE.Vector3;
  size: THREE.Vector2;
  hover: number;
  appear: { v: number };
}

const geo = new THREE.PlaneGeometry(1, 1, 16, 16);

export class WorldScene implements Scene3D {
  background = BG;
  scene = new THREE.Scene();
  private rig = pixelCamera(1000, 8000);
  cam = this.rig.cam;
  items: WorldItem[] = [];
  media: WorldMedia[] = [];
  private cols = 8;
  private rows = 7;
  private cell = new THREE.Vector2(460, 560);
  private field = new THREE.Vector2();
  drag = { x: 0, y: 0, vx: 0, vy: 0, active: false, strength: { v: 0 } };
  private rt: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMat: THREE.ShaderMaterial;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  hovered: WorldItem | null = null;
  open: WorldItem | null = null;
  private focus = { v: 0 };
  private focusFrom = new THREE.Vector3();
  private introGroup = new THREE.Group();
  active = false;
  visited = false;
  onHover: (it: WorldItem | null) => void = () => {};
  onOpen: (it: WorldItem | null) => void = () => {};

  constructor() {
    this.scene.background = new THREE.Color(BG);
    this.buildMedia();
    this.buildItems();
    this.buildIntro();
    this.rt = new THREE.WebGLRenderTarget(4, 4);
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        uStrength: { value: 0 },
        uAspect: { value: 1 },
        u_time: globalUniforms.u_time,
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tScene;
        uniform float uStrength, uAspect, u_time;
        varying vec2 vUv;
        void main() {
          vec2 c = vUv - 0.5;
          c.x *= uAspect;
          float r2 = dot(c, c);
          // barrel warp towards the edges while dragging
          float k = uStrength * 0.55;
          vec2 uv = 0.5 + (vUv - 0.5) * (1.0 - k * r2 * 1.4) / (1.0 - k * 0.25);
          float ca = uStrength * 0.012 * r2 * 4.0;
          vec2 dir = normalize(vUv - 0.5 + 1e-5);
          float r = texture2D(tScene, uv + dir * ca).r;
          float g = texture2D(tScene, uv).g;
          float b = texture2D(tScene, uv - dir * ca).b;
          vec3 col = vec3(r, g, b);
          col *= 1.0 - smoothstep(0.35, 1.2, length(c)) * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));
    this.resize();
    events.on('resize', () => this.resize());
  }

  private buildMedia() {
    let i = 0;
    PROJECTS.forEach((p) => {
      this.media.push({ url: p.cover, portrait: false, project: p, kind: 'campaign', index: i++ });
      p.images
        .filter((im) => im.url !== p.cover)
        .slice(0, 2)
        .forEach((im) => this.media.push({ url: im.url, portrait: true, project: p, kind: 'creator', index: i++ }));
    });
    // interleave campaigns and creator content
    this.media.sort((a, b) => ((a.index * 7919) % 101) - ((b.index * 7919) % 101));
    this.media.forEach((m, k) => (m.index = k));
  }

  private buildItems() {
    const rand = mulberry(7);
    const total = this.cols * this.rows;
    this.field.set(this.cols * this.cell.x, this.rows * this.cell.y);
    for (let s = 0; s < total; s++) {
      const media = this.media[s % this.media.length];
      const c = s % this.cols;
      const r = Math.floor(s / this.cols);
      const base = new THREE.Vector3(
        (c - this.cols / 2 + 0.5) * this.cell.x + (rand() - 0.5) * 120,
        (r - this.rows / 2 + 0.5) * this.cell.y + (c % 2 ? this.cell.y * 0.35 : 0) + (rand() - 0.5) * 140,
        -rand() * 520 + 80,
      );
      const w = media.portrait ? 200 + rand() * 70 : 300 + rand() * 90;
      const size = new THREE.Vector2(w, media.portrait ? w * (16 / 9) : w * 0.68);
      const mat = new THREE.ShaderMaterial({
        vertexShader: itemVert,
        fragmentShader: itemFrag,
        uniforms: {
          u_fluid: globalUniforms.u_fluid,
          u_curve: { value: 0.00009 },
          u_tex: { value: blankTexture },
          u_imageSize: { value: new THREE.Vector2(1, 1) },
          u_meshSize: { value: size.clone() },
          u_opacity: { value: 0 },
          u_hover: { value: 0 },
          u_focus: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
      });
      loadTexture(media.url).then((t) => {
        mat.uniforms.u_tex.value = t;
        mat.uniforms.u_imageSize.value.copy(t.userData.size);
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.scale.set(size.x, size.y, 1);
      this.scene.add(mesh);
      this.items.push({ media, mesh, base, size, hover: 0, appear: { v: 0 } });
    }
  }

  private buildIntro() {
    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(300, 24),
      new THREE.ShaderMaterial({
        uniforms: { u_time: globalUniforms.u_time, u_opacity: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform float u_time;
          varying vec3 vN;
          varying vec3 vView;
          varying vec3 vPos;
          void main() {
            vec3 p = position;
            p += normal * sin(p.y * 0.03 + u_time * 1.2) * 6.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vN = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            vPos = p;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float u_time, u_opacity;
          varying vec3 vN;
          varying vec3 vView;
          varying vec3 vPos;
          void main() {
            float f = pow(1.0 - max(dot(vN, vView), 0.0), 2.4);
            float bands = smoothstep(0.92, 1.0, sin(vPos.y * 0.09 - u_time * 2.0) * 0.5 + 0.5) * 0.25;
            vec3 col = vec3(0.92, 0.9, 1.0) * (f + bands * f);
            gl_FragColor = vec4(col, (f * 0.95 + bands) * u_opacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sphere.position.z = -260;
    this.introGroup.add(sphere);

    // "NUUKE" (logo) + "WORLD" with a flickering column-stripe shader
    const flickerFrag = /* glsl */ `
      precision highp float;
      uniform sampler2D u_tex;
      uniform float u_time, u_opacity;
      varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float a = texture2D(u_tex, vUv).a;
        float col = floor(vUv.x * 6.0);
        float t = floor(u_time * 14.0);
        float on = step(0.25, hash(col * 17.0 + t)) ;
        float settle = smoothstep(0.55, 1.0, u_opacity);
        float vis = mix(on, 1.0, settle) * smoothstep(0.0, 0.2, u_opacity);
        gl_FragColor = vec4(vec3(1.0), a * vis);
      }
    `;
    const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const logoMat = new THREE.ShaderMaterial({
      uniforms: { u_tex: { value: blankTexture }, u_time: globalUniforms.u_time, u_opacity: { value: 0 } },
      vertexShader: vert,
      fragmentShader: flickerFrag,
      transparent: true,
      depthWrite: false,
    });
    logoTexture().then((t) => (logoMat.uniforms.u_tex.value = t));
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(1, 83 / 342), logoMat);
    logo.position.y = 46;
    logo.scale.setScalar(state.w < 768 ? 280 : 460);

    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 200;
    const tex = new THREE.CanvasTexture(c);
    const draw = () => {
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = '#fff';
      g.font = '500 170px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      (g as any).letterSpacing = '-6px';
      g.fillText('WORLD', 512, 104);
      tex.needsUpdate = true;
    };
    draw();
    document.fonts.ready.then(draw);
    const wordMat = logoMat.clone();
    wordMat.uniforms = { u_tex: { value: tex }, u_time: globalUniforms.u_time, u_opacity: { value: 0 } };
    const word = new THREE.Mesh(new THREE.PlaneGeometry(1, 200 / 1024), wordMat);
    word.position.y = -58;
    word.scale.setScalar(state.w < 768 ? 300 : 480);
    this.introGroup.add(logo, word);
    this.introGroup.visible = false;
    this.scene.add(this.introGroup);
  }

  resize() {
    this.rig.fit();
    const size = new THREE.Vector2(state.w * state.dpr, state.h * state.dpr);
    this.rt.setSize(size.x, size.y);
    this.postMat.uniforms.uAspect.value = state.w / state.h;
  }

  // -------------------------------------------------------------- intro
  playIntro(): Promise<void> {
    const [sphere, logo, word] = this.introGroup.children as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[];
    this.items.forEach((it) => (it.appear.v = 0));
    const revealGrid = (delay: number) =>
      this.items.forEach((it) => {
        const d = Math.hypot(it.base.x + this.drag.x, it.base.y + this.drag.y) / 2200;
        gsap.to(it.appear, { v: 1, duration: 1.6, ease: 'expo.out', delay: delay + Math.min(d, 1.2) * 0.6 });
      });

    if (this.visited) {
      this.introGroup.visible = false;
      revealGrid(0.2);
      return Promise.resolve();
    }
    this.visited = true;
    this.introGroup.visible = true;
    this.introGroup.position.z = 0;
    this.introGroup.scale.setScalar(1);
    return new Promise((resolve) => {
      gsap
        .timeline({
          onComplete: () => {
            this.introGroup.visible = false;
            resolve();
          },
        })
        .fromTo(sphere.material.uniforms.u_opacity, { value: 0 }, { value: 1, duration: 1.6, ease: 'power2.out' })
        .fromTo(sphere.scale, { x: 0.4, y: 0.4, z: 0.4 }, { x: 1, y: 1, z: 1, duration: 2.2, ease: 'expo.out' }, 0)
        .fromTo(logo.material.uniforms.u_opacity, { value: 0 }, { value: 1, duration: 1.4, ease: 'none' }, 0.4)
        .fromTo(word.material.uniforms.u_opacity, { value: 0 }, { value: 1, duration: 1.4, ease: 'none' }, 0.6)
        .to(this.introGroup.position, { z: 1150, duration: 1.6, ease: 'expo.in' }, 2.6)
        .to([logo.material.uniforms.u_opacity, word.material.uniforms.u_opacity], { value: 0, duration: 0.6 }, 3.4)
        .to(sphere.material.uniforms.u_opacity, { value: 0, duration: 0.8 }, 3.3)
        .add(() => revealGrid(0), 3.2);
    });
  }

  // --------------------------------------------------------------- open
  openItem(it: WorldItem) {
    if (this.open === it) return;
    const current = this.open;
    this.open = it;
    this.focusFrom.copy(it.mesh.position);
    if (current) {
      gsap.to(current.mesh.material.uniforms.u_focus, { value: 0, duration: 0.6 });
    }
    this.focus.v = 0;
    gsap.to(this.focus, { v: 1, duration: 1.3, ease: 'expo.inOut', overwrite: true });
    gsap.to(it.mesh.material.uniforms.u_focus, { value: 1, duration: 1 });
    this.drag.vx = this.drag.vy = 0;
    this.onOpen(it);
  }

  closeItem() {
    const it = this.open;
    if (!it) return;
    gsap.to(this.focus, {
      v: 0,
      duration: 1.1,
      ease: 'expo.inOut',
      overwrite: true,
      onComplete: () => {
        if (this.open === it) this.open = null;
      },
    });
    gsap.to(it.mesh.material.uniforms.u_focus, { value: 0, duration: 1 });
    this.onOpen(null);
  }

  step(dir: 1 | -1) {
    if (!this.open) return;
    const idx = this.open.media.index;
    const n = this.media.length;
    const targetIdx = (idx + dir + n) % n;
    // choose the on-field instance of that media closest to the centre
    const candidates = this.items.filter((i) => i.media.index === targetIdx);
    const next = candidates.sort((a, b) => a.mesh.position.length() - b.mesh.position.length())[0];
    if (!next) return;
    // pan the field so the next WorldItem sits near the centre
    this.drag.x -= next.mesh.position.x * 0.9;
    this.drag.y -= next.mesh.position.y * 0.9;
    this.openItem(next);
  }

  // ------------------------------------------------------------ helpers
  private wrap(v: number, size: number) {
    return ((((v + size / 2) % size) + size) % size) - size / 2;
  }

  pick(x = state.mouse.x, y = state.mouse.y) {
    this.ndc.set((x / state.w) * 2 - 1, -(y / state.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.cam);
    const hit = this.raycaster.intersectObjects(
      this.items.filter((i) => i.appear.v > 0.5).map((i) => i.mesh),
      false,
    )[0];
    return hit ? this.items.find((i) => i.mesh === hit.object) ?? null : null;
  }

  // ------------------------------------------------------------- update
  update(dt: number) {
    const d = this.drag;
    if (!d.active) {
      const f = Math.pow(0.955, dt * 60);
      d.vx *= f;
      d.vy *= f;
      d.x += d.vx * dt * 60;
      d.y += d.vy * dt * 60;
    }

    const cam = this.cam;
    const zoomOut = d.strength.v * 280;
    cam.position.z = damp(cam.position.z, 1000 + zoomOut - this.focus.v * 0, 6, dt);
    cam.rotation.y = damp(cam.rotation.y, -state.smooth.nx * 0.07 * (1 - this.focus.v), 4, dt);
    cam.rotation.x = damp(cam.rotation.x, state.smooth.ny * 0.05 * (1 - this.focus.v), 4, dt);

    const fv = this.focus.v;
    const fitH = state.h * (state.w < 768 ? 0.5 : 0.62);
    const fitW = state.w * (state.w < 768 ? 0.82 : 0.5);

    this.items.forEach((it) => {
      const x = this.wrap(it.base.x + d.x, this.field.x);
      const y = this.wrap(it.base.y + d.y, this.field.y);
      let px = x;
      let py = y;
      let pz = it.base.z;
      let sx = it.size.x;
      let sy = it.size.y;
      let op = it.appear.v;
      if (this.open) {
        if (it === this.open) {
          const k = Math.min(fitH / it.size.y, fitW / it.size.x) / 1.25;
          px = THREE.MathUtils.lerp(x, state.w < 768 ? 0 : state.w * 0.08, fv);
          py = THREE.MathUtils.lerp(y, state.h * 0.04, fv);
          pz = THREE.MathUtils.lerp(it.base.z, 200, fv);
          sx = THREE.MathUtils.lerp(it.size.x, it.size.x * k, fv);
          sy = THREE.MathUtils.lerp(it.size.y, it.size.y * k, fv);
          it.mesh.renderOrder = 100;
          it.mesh.material.uniforms.u_curve.value = 0.00009 * (1 - fv);
        } else {
          op *= 1 - fv * 0.85;
          it.mesh.renderOrder = 0;
        }
      } else {
        it.mesh.renderOrder = 0;
        it.mesh.material.uniforms.u_curve.value = 0.00009;
      }
      it.mesh.position.set(px, py, pz);
      it.mesh.scale.set(sx, sy, 1);
      it.hover = damp(it.hover, this.hovered === it && !this.open ? 1 : 0, 8, dt);
      it.mesh.material.uniforms.u_hover.value = it.hover;
      it.mesh.material.uniforms.u_opacity.value = op;
    });

    if (this.active && !d.active && !state.isTouch) {
      const h = this.open ? null : this.pick();
      if (h !== this.hovered) {
        this.hovered = h;
        this.onHover(h);
      }
    }
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.cam);
    this.postMat.uniforms.tScene.value = this.rt.texture;
    this.postMat.uniforms.uStrength.value = this.drag.strength.v;
    renderer.setRenderTarget(target);
    renderer.render(this.postScene, this.postCam);
  }
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
