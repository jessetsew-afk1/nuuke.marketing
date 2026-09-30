import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Scene3D, gl, pixelCamera } from '../gl';
import { buildProduct } from '../products';
import type { Project } from '../../data/projects';
import { damp, events, state } from '../../core/state';

const BG = '#1f1f1f';

interface Slot {
  group: THREE.Group;
  anchor: HTMLElement;
  spin: number;
}

/**
 * Dark stage for case studies: the brand's 3D product floats in the hero and
 * the next brand's product waits at the bottom of the page. Both follow DOM
 * anchors so they scroll with the layout.
 */
export class CaseScene implements Scene3D {
  background = BG;
  scene = new THREE.Scene();
  private rig = pixelCamera(1000, 6000);
  cam = this.rig.cam;
  private slots: Slot[] = [];
  private lastScroll = 0;
  private scrollVel = 0;

  constructor() {
    this.scene.background = new THREE.Color(BG);
    const pmrem = new THREE.PMREMGenerator(gl.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(400, 600, 900);
    const rim = new THREE.DirectionalLight('#c9b8ff', 1.2);
    rim.position.set(-700, 200, -400);
    this.scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.25));
    events.on('resize', () => this.rig.fit());
  }

  set(entries: { project: Project; anchor: HTMLElement }[]) {
    this.clear();
    entries.forEach(({ project, anchor }, i) => {
      const group = new THREE.Group();
      group.add(buildProduct(project));
      this.scene.add(group);
      this.slots.push({ group, anchor, spin: i * 1.3 });
    });
  }

  clear() {
    this.slots.forEach((s) => {
      this.scene.remove(s.group);
      s.group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => {
          (mt as THREE.MeshStandardMaterial).map?.dispose();
          mt.dispose();
        });
      });
    });
    this.slots = [];
  }

  update(dt: number, time: number) {
    const y = window.scrollY;
    this.scrollVel = damp(this.scrollVel, (y - this.lastScroll) / Math.max(dt, 1e-3), 6, dt);
    this.lastScroll = y;
    this.slots.forEach((s, i) => {
      const r = s.anchor.getBoundingClientRect();
      const visible = r.bottom > -r.height && r.top < state.h + r.height;
      s.group.visible = visible && r.height > 0;
      if (!s.group.visible) return;
      const cx = r.left + r.width / 2 - state.w / 2;
      const cy = state.h / 2 - (r.top + r.height / 2);
      s.group.position.set(cx, cy + Math.sin(time * 0.8 + i) * 8, 0);
      s.group.scale.setScalar(Math.min(r.height, r.width) / 2.5);
      s.spin += dt * (0.35 + Math.min(2, Math.abs(this.scrollVel) / 900));
      s.group.rotation.y = s.spin + state.smooth.nx * 0.5;
      s.group.rotation.x = -state.smooth.ny * 0.25 + THREE.MathUtils.clamp(this.scrollVel / 4000, -0.3, 0.3);
      s.group.rotation.z = Math.sin(time * 0.5 + i) * 0.05;
    });
  }

  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }

  resize() {
    this.rig.fit();
  }
}
