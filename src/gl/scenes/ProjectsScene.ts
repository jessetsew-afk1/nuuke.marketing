import * as THREE from 'three';
import gsap from 'gsap';
import { Scene3D, globalUniforms, pixelCamera } from '../gl';
import { blankTexture, loadTexture, makeMatcap } from '../assets';
import { Butterflies } from '../Butterflies';
import { PROJECTS, Project, Category } from '../../data/projects';
import { clamp, damp, events, state } from '../../core/state';

const BG = '#e7e7e7';
const INK = '#111111';

const tileVert = /* glsl */ `
  uniform float u_time;
  uniform sampler2D u_fluid;
  uniform vec2 u_bend;
  uniform float u_drop;
  uniform float u_velocity;
  varying vec2 vUv;
  varying float vDepth;
  varying float vWave;
  varying vec2 vFluid;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    float t = smoothstep(u_bend.x, u_bend.y, world.y);
    float t2 = smoothstep(u_bend.x * 1.1, u_bend.y * 0.7, world.y);

    // slow travelling ripple across the whole grid, stronger while scrolling
    float wave = sin((world.x - world.y) * 0.02 - u_time * 2.0) * (10.0 + u_velocity * 18.0);
    float drift = sin((world.x - world.y * 0.1) * 0.03 - u_time * 1.1 + cos(world.z * 0.04) * 10.0) * 50.0;
    float sway = sin((world.x + world.y * 0.1) * 0.01 - u_time * 0.4) * 0.5;

    world.z += wave;
    // tiles bend backwards into the distance as they rise past the bend point
    world.z -= 1200.0 * t + drift * t;
    world.y -= (0.35 - sway * 0.2) * t2 * u_drop;

    vec4 clip = projectionMatrix * viewMatrix * world;
    vec2 screen = clip.xy / clip.w * 0.5 + 0.5;
    vec2 fl = texture2D(u_fluid, screen).xy;
    world.xy += fl * 1.4;

    vFluid = fl;
    vWave = wave;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const tileFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D u_tex;
  uniform vec2 u_imageSize;
  uniform vec2 u_meshSize;
  uniform float u_zoom;
  uniform float u_opacity;
  uniform float u_isLabel;
  uniform vec3 u_fogColor;
  uniform float u_fogNear;
  uniform float u_fogFar;
  varying vec2 vUv;
  varying float vDepth;
  varying float vWave;
  varying vec2 vFluid;

  vec2 coverUv(vec2 uv, vec2 mesh, vec2 img) {
    float rm = mesh.x / mesh.y, ri = img.x / img.y;
    vec2 s = rm < ri ? vec2(rm / ri, 1.0) : vec2(1.0, ri / rm);
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    vec2 uv = u_isLabel > 0.5 ? vUv : coverUv(vUv, u_meshSize, u_imageSize);
    uv = (uv - 0.5) / u_zoom + 0.5;
    vec4 col = texture2D(u_tex, uv);
    if (u_isLabel < 0.5) {
      col.rgb += smoothstep(0.0, 10.0, vWave * 0.3) * 0.22;
      col.rgb += length(vFluid) * 0.012;
    }
    float fogF = smoothstep(u_fogNear, u_fogFar, vDepth);
    col.rgb = mix(col.rgb, u_fogColor, fogF);
    col.a *= smoothstep(2700.0, 1900.0, vDepth) * u_opacity;
    gl_FragColor = col;
  }
`;

interface Item {
  project: Project;
  group: THREE.Group;
  img: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  label: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  pos: { x: number; y: number };
  anim: { opacity: number; lift: number; zoom: number; scale: number };
  visible: boolean;
  index: number;
}

const planeGeo = new THREE.PlaneGeometry(1, 1, 28, 28);

export class ProjectsScene implements Scene3D {
  background = BG;
  scene = new THREE.Scene();
  private camRig = pixelCamera(1000, 14000);
  cam = this.camRig.cam;
  items: Item[] = [];
  scroll = { target: 0, current: 0, max: 0, velocity: 0 };
  /** Distance in CSS px from top of viewport to bottom of the DOM filters. */
  headerBottom = 190;
  private tile = { w: 400, h: 260, labelH: 36, gap: 20, rowH: 400 };
  private bend = new THREE.Vector2(100, 600);
  private sharedUniforms = {
    u_bend: { value: this.bend },
    u_velocity: { value: 0 },
    u_fogColor: { value: new THREE.Color(BG) },
    u_fogNear: { value: 1150 },
    u_fogFar: { value: 2600 },
  };
  private env = new THREE.Group();
  private arches!: THREE.InstancedMesh;
  private archSpacing = 1700;
  private archCount = 7;
  private floorTex!: THREE.CanvasTexture;
  private rays: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
  private dummy = new THREE.Object3D();
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  hovered: Item | null = null;
  private intro = { z: 0, envOffset: 0 };
  active = false;
  filter: Category | 'all' = 'all';
  onHover: (it: Item | null) => void = () => {};
  private butterflies = new Butterflies(BG);
  private spawnPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -140);
  private spawnPoint = new THREE.Vector3();
  private spawnAcc = 0;

  constructor() {
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 500, 5600);
    this.buildEnvironment();
    this.buildItems();
    this.scene.add(this.butterflies.mesh);
    this.layout(true);
    events.on('resize', () => this.layout(true));
  }

  // ---------------------------------------------------------------- build
  private buildEnvironment() {
    const matcap = makeMatcap('#ffffff', '#e6e4e2', '#b3b0ae');

    // Colonnade of arches the camera travels through while scrolling.
    const R = 820;
    const legH = 700;
    const pillar = 320;
    const shape = new THREE.Shape();
    shape.moveTo(-R - pillar, -legH);
    shape.lineTo(-R, -legH);
    shape.lineTo(-R, 0);
    shape.absarc(0, 0, R, Math.PI, 0, true);
    shape.lineTo(R, -legH);
    shape.lineTo(R + pillar, -legH);
    shape.lineTo(R + pillar, R + pillar);
    shape.lineTo(-R - pillar, R + pillar);
    shape.closePath();
    const archGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 220,
      bevelEnabled: true,
      bevelThickness: 18,
      bevelSize: 18,
      bevelSegments: 3,
      curveSegments: 64,
    });
    archGeo.translate(0, 0, -110);
    const archMat = new THREE.MeshMatcapMaterial({ matcap, color: new THREE.Color('#f4f4f3') });
    this.arches = new THREE.InstancedMesh(archGeo, archMat, this.archCount);
    this.arches.frustumCulled = false;
    this.env.add(this.arches);

    // Floor with a faint tile grid, scrolled with the arches.
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    g.fillStyle = '#dcdcdc';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(0,0,0,0.07)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 512, 512);
    const sheen = g.createLinearGradient(0, 0, 512, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.18)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, 512, 512);
    this.floorTex = new THREE.CanvasTexture(c);
    this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
    this.floorTex.repeat.set(8, 28);
    this.floorTex.anisotropy = 8;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 14000),
      new THREE.MeshBasicMaterial({ map: this.floorTex }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -700, -5500);
    this.env.add(floor);

    // God rays: additive light shafts with drifting noise.
    const rayMat = () =>
      new THREE.ShaderMaterial({
        uniforms: { u_time: globalUniforms.u_time, u_seed: { value: Math.random() * 10 }, u_strength: { value: 0.28 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying float vDepth;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float u_time, u_seed, u_strength;
          varying vec2 vUv;
          varying float vDepth;
          float hash(float n) { return fract(sin(n) * 43758.5453); }
          float noise(float x) { float i = floor(x), f = fract(x); return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f)); }
          void main() {
            float x = vUv.x;
            float n = noise(x * 9.0 + u_seed + u_time * 0.25) * noise(x * 23.0 - u_time * 0.4 + u_seed * 2.0);
            float edges = smoothstep(0.0, 0.25, x) * smoothstep(1.0, 0.75, x);
            float fall = pow(vUv.y, 1.6);
            float a = n * edges * fall * u_strength;
            a *= smoothstep(9000.0, 3000.0, vDepth);
            gl_FragColor = vec4(vec3(1.0), a);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 4200), rayMat());
      m.position.set((i - 2.5) * 520, 900, -2200 - i * 700);
      m.rotation.z = -0.35 + i * 0.05;
      this.rays.push(m);
      this.env.add(m);
    }
    this.scene.add(this.env);
  }

  private buildItems() {
    PROJECTS.forEach((project, index) => {
      const group = new THREE.Group();
      const makeMat = (isLabel: boolean, tex: THREE.Texture) =>
        new THREE.ShaderMaterial({
          vertexShader: tileVert,
          fragmentShader: tileFrag,
          uniforms: {
            ...this.sharedUniforms,
            u_time: globalUniforms.u_time,
            u_fluid: globalUniforms.u_fluid,
            u_tex: { value: tex },
            u_imageSize: { value: new THREE.Vector2(1, 1) },
            u_meshSize: { value: new THREE.Vector2(1, 1) },
            u_zoom: { value: 1 },
            u_opacity: { value: 0 },
            u_isLabel: { value: isLabel ? 1 : 0 },
            u_drop: { value: 260 },
          },
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      const imgMat = makeMat(false, blankTexture);
      const img = new THREE.Mesh(planeGeo, imgMat);
      img.frustumCulled = false;
      img.renderOrder = index * 2;
      loadTexture(project.cover).then((tex) => {
        imgMat.uniforms.u_tex.value = tex;
        imgMat.uniforms.u_imageSize.value.copy(tex.userData.size);
      });

      const labelMat = makeMat(true, this.labelTexture(project));
      const label = new THREE.Mesh(planeGeo, labelMat);
      label.frustumCulled = false;
      label.renderOrder = index * 2 + 1;

      group.add(img, label);
      this.scene.add(group);
      this.items.push({
        project,
        group,
        img,
        label,
        pos: { x: 0, y: 0 },
        anim: { opacity: 0, lift: -state.h * 0.9, zoom: 1, scale: 1 },
        visible: true,
        index,
      });
    });
  }

  /** Title + description + underline + arrow, drawn to a canvas. */
  private labelTexture(p: Project) {
    const c = document.createElement('canvas');
    c.width = 1640;
    c.height = 148;
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const draw = () => {
      const g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      g.textBaseline = 'top';
      // keep both lines clear of the arrow on the right
      const maxW = c.width - 90;
      const fit = (text: string, weight: number) => {
        let size = 50;
        g.font = `${weight} ${size}px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif`;
        while (g.measureText(text).width > maxW && size > 36) {
          size -= 2;
          g.font = `${weight} ${size}px "Inter Tight Variable", "Helvetica Neue", Arial, sans-serif`;
        }
        let t = text;
        while (g.measureText(t).width > maxW && t.length > 4) t = t.replace(/…$/, '').slice(0, -1).trimEnd() + '…';
        return t;
      };
      g.fillStyle = INK;
      g.fillText(fit(`${p.client} — ${p.title}`, 600), 0, 2);
      g.fillStyle = 'rgba(17,17,17,0.6)';
      g.fillText(fit(p.description, 400), 0, 66);
      g.fillStyle = INK;
      g.fillRect(0, c.height - 3, c.width, 3);
      // arrow ↘
      g.strokeStyle = INK;
      g.lineWidth = 4;
      const ax = c.width - 34;
      const ay = c.height - 66;
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(ax + 26, ay + 26);
      g.moveTo(ax + 26, ay + 4);
      g.lineTo(ax + 26, ay + 26);
      g.lineTo(ax + 4, ay + 26);
      g.stroke();
      tex.needsUpdate = true;
    };
    draw();
    document.fonts.ready.then(draw);
    return tex;
  }

  // --------------------------------------------------------------- layout
  layout(immediate = false) {
    this.camRig.fit();
    const w = state.w;
    const h = state.h;
    const md = w >= 768;
    const cols = md ? 2 : 1;
    const big = w >= 1600 ? 1.1 : 1;
    const tw = md ? clamp(w * 0.3, 300, 660) * big : w - 32;
    const th = tw * 0.64;
    const labelH = tw * (148 / 1640);
    const gap = md ? 22 : 12;
    const rowH = th + 10 + labelH + (md ? 60 : 44);
    this.tile = { w: tw, h: th, labelH, gap, rowH };
    this.bend.set(h * 0.16, h * 0.9);

    const top = h / 2 - this.headerBottom - (md ? 56 : 36);
    const visible = this.items.filter((i) => i.visible);
    visible.forEach((it, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = cols === 2 ? (col === 0 ? -1 : 1) * (tw + gap) * 0.5 : 0;
      const y = top - row * rowH - th / 2;
      if (immediate) {
        it.pos.x = x;
        it.pos.y = y;
      } else {
        gsap.to(it.pos, { x, y, duration: 1.4, ease: 'expo.inOut', delay: i * 0.02 });
      }
      it.img.scale.set(tw, th, 1);
      it.img.material.uniforms.u_meshSize.value.set(tw, th);
      it.img.material.uniforms.u_drop.value = th;
      it.label.scale.set(tw, labelH, 1);
      it.label.position.set(0, -th / 2 - 10 - labelH / 2, 0);
      it.label.material.uniforms.u_drop.value = th;
    });
    const rows = Math.ceil(visible.length / cols);
    const total = this.headerBottom + (md ? 56 : 36) + rows * rowH;
    this.scroll.max = Math.max(0, total - h * 0.62);
    this.scroll.target = clamp(this.scroll.target, 0, this.scroll.max);
  }

  // ---------------------------------------------------------------- intro
  playIntro(delay = 0) {
    this.intro.z = 900;
    this.intro.envOffset = -2400;
    gsap.to(this.intro, { z: 0, envOffset: 0, duration: 2.6, ease: 'power3.out', delay });
    this.items.forEach((it) => {
      if (!it.visible) return;
      it.anim.lift = -state.h * 0.9;
      it.anim.opacity = 0;
      gsap.to(it.anim, {
        lift: 0,
        opacity: 1,
        duration: 1.9,
        ease: 'expo.out',
        delay: delay + 0.25 + it.index * 0.045,
      });
    });
  }

  /** Items fade out; the chosen one scales up, ready for the page transition. */
  playSelect(slug: string) {
    this.items.forEach((it) => {
      if (it.project.slug === slug) {
        gsap.to(it.anim, { scale: 1.25, zoom: 1.15, duration: 1.4, ease: 'expo.inOut' });
      } else {
        gsap.to(it.anim, { opacity: 0, duration: 0.7, ease: 'power2.out' });
      }
    });
  }

  resetAfterLeave() {
    this.items.forEach((it) => {
      gsap.killTweensOf(it.anim);
      it.anim.scale = 1;
      it.anim.zoom = 1;
    });
  }

  setFilter(filter: Category | 'all') {
    if (filter === this.filter) return;
    this.filter = filter;
    this.items.forEach((it) => {
      const show = filter === 'all' || it.project.categories.includes(filter);
      if (show === it.visible) return;
      it.visible = show;
      gsap.killTweensOf(it.anim);
      if (show) {
        it.anim.lift = -state.h * 0.6;
        gsap.to(it.anim, { lift: 0, opacity: 1, duration: 1.6, ease: 'expo.out', delay: 0.35 });
      } else {
        gsap.to(it.anim, { opacity: 0, lift: -120, duration: 0.6, ease: 'power2.in' });
      }
    });
    this.scroll.target = 0;
    this.layout(false);
  }

  // ---------------------------------------------------------------- input
  addScroll(delta: number) {
    this.scroll.target = clamp(this.scroll.target + delta, 0, this.scroll.max);
  }

  private pick() {
    if (!this.active || state.isTouch) return null;
    this.ndc.set(state.mouse.nx, state.mouse.ny);
    this.raycaster.setFromCamera(this.ndc, this.cam);
    const targets = this.items
      .filter((i) => i.visible && i.anim.opacity > 0.5 && i.group.position.y < this.bend.x + this.tile.h * 0.5)
      .map((i) => i.img);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit ? this.items.find((i) => i.img === hit.object) ?? null : null;
  }

  /** Item under a screen point, used for taps on touch devices. */
  itemAt(x: number, y: number) {
    this.ndc.set((x / state.w) * 2 - 1, -(y / state.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.cam);
    const hit = this.raycaster.intersectObjects(
      this.items.filter((i) => i.visible).map((i) => i.img),
      false,
    )[0];
    return hit ? this.items.find((i) => i.img === hit.object) ?? null : null;
  }

  // --------------------------------------------------------------- update
  update(dt: number, time: number) {
    const s = this.scroll;
    const prev = s.current;
    s.current = damp(s.current, s.target, 5.5, dt);
    s.velocity = damp(s.velocity, Math.abs(s.current - prev) / Math.max(dt, 1e-3) / 1000, 6, dt);
    this.sharedUniforms.u_velocity.value = Math.min(1.5, s.velocity);

    // camera parallax
    const cam = this.cam;
    cam.position.x = state.smooth.nx * 26;
    cam.position.y = state.smooth.ny * 18;
    cam.position.z = 1000 + this.intro.z;
    cam.rotation.y = state.smooth.nx * 0.035;
    cam.rotation.x = -state.smooth.ny * 0.02;

    // tiles
    this.items.forEach((it) => {
      it.group.position.set(it.pos.x, it.pos.y + s.current + it.anim.lift, 0);
      it.group.scale.setScalar(it.anim.scale);
      it.group.visible = it.anim.opacity > 0.001;
      const hoverTarget = this.hovered === it ? 1.07 : 1;
      it.anim.zoom = it.anim.scale > 1 ? it.anim.zoom : damp(it.anim.zoom, hoverTarget, 7, dt);
      it.img.material.uniforms.u_zoom.value = it.anim.zoom;
      it.img.material.uniforms.u_opacity.value = it.anim.opacity;
      it.label.material.uniforms.u_opacity.value = it.anim.opacity;
    });

    // environment travels with scroll (plus a slow idle drift)
    const travel = s.current * 1.4 + time * 18 + this.intro.envOffset;
    const offset = ((travel % this.archSpacing) + this.archSpacing) % this.archSpacing;
    for (let i = 0; i < this.archCount; i++) {
      this.dummy.position.set(0, 0, -600 - i * this.archSpacing + offset);
      this.dummy.updateMatrix();
      this.arches.setMatrixAt(i, this.dummy.matrix);
    }
    this.arches.instanceMatrix.needsUpdate = true;
    this.floorTex.offset.y = -travel / (14000 / 28);
    this.rays.forEach((r, i) => {
      r.position.x = (i - 2.5) * 520 + Math.sin(time * 0.1 + i) * 60;
    });

    // butterflies drift off the cursor while a project is hovered
    if (this.active && this.hovered && !state.isTouch) {
      this.spawnAcc += dt * 7;
      while (this.spawnAcc > 1) {
        this.spawnAcc -= 1;
        this.ndc.set(state.mouse.nx, state.mouse.ny);
        this.raycaster.setFromCamera(this.ndc, this.cam);
        if (this.raycaster.ray.intersectPlane(this.spawnPlane, this.spawnPoint)) this.butterflies.spawn(this.spawnPoint);
      }
    }
    this.butterflies.update(dt, time);

    // hover
    if (this.active && !state.mouse.down) {
      const h = this.pick();
      if (h !== this.hovered) {
        this.hovered = h;
        this.onHover(h);
      }
    }
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }

  resize() {
    this.layout(true);
  }
}
