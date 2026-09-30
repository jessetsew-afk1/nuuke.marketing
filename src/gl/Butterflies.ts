import * as THREE from 'three';
import { globalUniforms } from './gl';

/**
 * Faint butterflies that spawn at the cursor while a project is hovered,
 * then flutter away in a loose flock and fade into the fog.
 * Wings are two quads per instance, flapped in the vertex shader; motion is
 * a small CPU boids sim (separation / alignment / cohesion + wander).
 */

const COUNT = 90;

const wingAtlas = () => {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const g = c.getContext('2d')!;
  const palettes = [
    ['#fff2f6', '#f3bfd3', '#c9839f'],
    ['#f1efff', '#bdb6f0', '#7f76c9'],
    ['#fff4e6', '#f6c897', '#d08a4f'],
    ['#ffffff', '#dfe5ef', '#9ea9bd'],
  ];
  palettes.forEach((p, i) => {
    const ox = (i % 2) * size;
    const oy = Math.floor(i / 2) * size;
    g.save();
    g.translate(ox, oy);
    // u (x) = body -> tip, v (y) = back -> front ; canvas y is flipped later by UVs
    const wing = (cx: number, cy: number, rx: number, ry: number, rot: number) => {
      g.save();
      g.translate(cx * size, cy * size);
      g.rotate(rot);
      const grd = g.createRadialGradient(-rx * size * 0.6, 0, 2, 0, 0, rx * size);
      grd.addColorStop(0, p[0]);
      grd.addColorStop(0.6, p[1]);
      grd.addColorStop(1, p[2]);
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(0, 0, rx * size, ry * size, 0, 0, Math.PI * 2);
      g.fill();
      // veins
      g.strokeStyle = 'rgba(60,40,60,0.35)';
      g.lineWidth = 2;
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(-rx * size, 0);
        g.quadraticCurveTo(0, k * ry * size * 0.25, rx * size * 0.95, k * ry * size * 0.4);
        g.stroke();
      }
      // edge dots
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 7; k++) {
        const a = -0.9 + k * 0.3;
        g.beginPath();
        g.arc(Math.cos(a) * rx * size * 0.82, Math.sin(a) * ry * size * 0.78, 4, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    };
    wing(0.5, 0.32, 0.47, 0.24, -0.35); // forewing
    wing(0.36, 0.7, 0.34, 0.22, 0.35); // hindwing
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
};

const buildGeometry = () => {
  // right wing x: 0..1, left wing x: -1..0, z: -0.5..0.5 (z = forward)
  const pos: number[] = [];
  const uv: number[] = [];
  const side: number[] = [];
  const idx: number[] = [];
  [1, -1].forEach((s, w) => {
    const base = w * 4;
    const quad = [
      [0, -0.5],
      [s, -0.5],
      [s, 0.5],
      [0, 0.5],
    ];
    quad.forEach(([x, z]) => {
      pos.push(x, 0, z);
      uv.push(Math.abs(x), 0.5 - z); // v: front (z=.5) -> 0, back -> 1
      side.push(s);
    });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
};

interface Bug {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  alive: boolean;
}

export class Butterflies {
  mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private bugs: Bug[] = [];
  private aPhase: THREE.InstancedBufferAttribute;
  private aAtlas: THREE.InstancedBufferAttribute;
  private aAlpha: THREE.InstancedBufferAttribute;
  private dummy = new THREE.Object3D();
  private next = 0;
  private tmp = new THREE.Vector3();
  private center = new THREE.Vector3();

  constructor(fogColor: string) {
    const geo = buildGeometry();
    this.aPhase = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
    this.aAtlas = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 2), 2);
    this.aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(COUNT), 1);
    for (let i = 0; i < COUNT; i++) {
      this.aPhase.setX(i, Math.random() * Math.PI * 2);
      const a = Math.floor(Math.random() * 4);
      this.aAtlas.setXY(i, (a % 2) * 0.5, Math.floor(a / 2) * 0.5);
    }
    geo.setAttribute('aPhase', this.aPhase);
    geo.setAttribute('aAtlas', this.aAtlas);
    geo.setAttribute('aAlpha', this.aAlpha);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        u_time: globalUniforms.u_time,
        u_tex: { value: wingAtlas() },
        u_fog: { value: new THREE.Color(fogColor) },
        u_opacity: { value: 0.62 },
      },
      vertexShader: /* glsl */ `
        uniform float u_time;
        attribute float aSide;
        attribute float aPhase;
        attribute vec2 aAtlas;
        attribute float aAlpha;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vShade;
        varying float vDepth;
        void main() {
          float flap = sin(u_time * 13.0 + aPhase) * 0.95 + 0.25;
          float ang = flap * aSide;
          vec3 p = position;
          float ax = abs(p.x);
          p.x = aSide * ax * cos(flap);
          p.y = ax * sin(flap);
          vUv = aAtlas + uv * 0.5;
          vAlpha = aAlpha;
          vShade = 0.8 + 0.2 * cos(ang);
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D u_tex;
        uniform vec3 u_fog;
        uniform float u_opacity;
        varying vec2 vUv;
        varying float vAlpha;
        varying float vShade;
        varying float vDepth;
        void main() {
          vec4 c = texture2D(u_tex, vUv);
          if (c.a < 0.02) discard;
          vec3 col = c.rgb * vShade;
          col = mix(col, u_fog, smoothstep(900.0, 2600.0, vDepth));
          gl_FragColor = vec4(col, c.a * vAlpha * u_opacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 999;
    for (let i = 0; i < COUNT; i++) {
      this.bugs.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0, max: 1, size: 1, alive: false });
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
  }

  spawn(at: THREE.Vector3) {
    const b = this.bugs[this.next];
    this.next = (this.next + 1) % COUNT;
    b.alive = true;
    b.pos.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0));
    const a = Math.random() * Math.PI * 2;
    b.vel.set(Math.cos(a) * 110, 60 + Math.random() * 90, -40 - Math.random() * 120);
    b.life = 0;
    b.max = 5 + Math.random() * 4;
    b.size = 14 + Math.random() * 12;
  }

  update(dt: number, time: number) {
    // flock centre of living bugs
    let n = 0;
    this.center.set(0, 0, 0);
    for (const b of this.bugs) {
      if (!b.alive) continue;
      this.center.add(b.pos);
      n++;
    }
    if (n) this.center.divideScalar(n);

    this.bugs.forEach((b, i) => {
      if (!b.alive) {
        this.aAlpha.setX(i, 0);
        return;
      }
      b.life += dt;
      if (b.life > b.max) {
        b.alive = false;
        this.dummy.scale.setScalar(0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        this.aAlpha.setX(i, 0);
        return;
      }
      // steering
      const acc = this.tmp.set(0, 0, 0);
      acc.x += Math.sin(time * 1.3 + i * 7.1) * 90;
      acc.y += Math.cos(time * 1.1 + i * 3.7) * 70 + 18;
      acc.z += Math.sin(time * 0.9 + i) * 40 - 20;
      if (n > 1) {
        acc.x += (this.center.x - b.pos.x) * 0.15;
        acc.y += (this.center.y - b.pos.y) * 0.15;
        for (let k = 0; k < this.bugs.length; k += 3) {
          const o = this.bugs[k];
          if (o === b || !o.alive) continue;
          const dx = b.pos.x - o.pos.x;
          const dy = b.pos.y - o.pos.y;
          const dz = b.pos.z - o.pos.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 3600 && d2 > 1) {
            acc.x += (dx / d2) * 4000;
            acc.y += (dy / d2) * 4000;
            acc.z += (dz / d2) * 4000;
          }
          if (d2 < 40000) b.vel.lerp(o.vel, 0.002);
        }
      }
      b.vel.addScaledVector(acc, dt);
      const sp = b.vel.length();
      if (sp > 180) b.vel.multiplyScalar(180 / sp);
      if (sp < 50) b.vel.multiplyScalar(50 / Math.max(sp, 1));
      b.pos.addScaledVector(b.vel, dt);

      const grow = Math.min(1, b.life / 0.45);
      const fade = 1 - THREE.MathUtils.smoothstep(b.life, b.max - 1.6, b.max);
      this.aAlpha.setX(i, Math.min(grow, 1) * fade);

      this.dummy.position.copy(b.pos);
      this.dummy.lookAt(this.tmp.copy(b.pos).add(b.vel));
      this.dummy.scale.setScalar(b.size * (0.2 + 0.8 * grow));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
  }
}
