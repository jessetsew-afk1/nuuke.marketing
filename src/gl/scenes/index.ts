import * as THREE from 'three';
import type { Scene3D } from '../gl';
import { ProjectsScene } from './ProjectsScene';
import { HomeScene } from './HomeScene';
import { WorldScene } from './WorldScene';
import { CaseScene } from './CaseScene';

/** Scenes are created once and kept alive so returning to a page is instant. */
let projects: ProjectsScene | null = null;
let home: HomeScene | null = null;
let world: WorldScene | null = null;
let caseScene: CaseScene | null = null;

export const getProjectsScene = () => (projects ??= new ProjectsScene());
export const getHomeScene = () => (home ??= new HomeScene());
export const getWorldScene = () => (world ??= new WorldScene());
export const getCaseScene = () => (caseScene ??= new CaseScene());

/** Flat colour scene for DOM-driven pages (case studies). */
export class PlainScene implements Scene3D {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(public background: string) {
    this.scene.background = new THREE.Color(background);
  }
  update() {}
  render(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.cam);
  }
  resize() {}
}

let plain: PlainScene | null = null;
export const getPlainScene = () => (plain ??= new PlainScene('#e7e7e7'));
