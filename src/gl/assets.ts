import * as THREE from 'three';
import { gl } from './gl';

const cache = new Map<string, Promise<THREE.Texture>>();
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous');

/** Placeholder 1×1 texture used until the real image arrives. */
export const blankTexture = (() => {
  const t = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1);
  t.needsUpdate = true;
  t.userData.size = new THREE.Vector2(1, 1);
  return t;
})();

export const loadTexture = (url: string) => {
  if (!cache.has(url)) {
    cache.set(
      url,
      new Promise((res) => {
        loader.load(
          url,
          (tex) => {
            const img = tex.image as HTMLImageElement;
            tex.userData.size = new THREE.Vector2(img.naturalWidth || img.width, img.naturalHeight || img.height);
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.generateMipmaps = true;
            tex.anisotropy = 4;
            // upload now, spread across loading, rather than on first render
            if (gl.ok && gl.renderer) gl.renderer.initTexture(tex);
            res(tex);
          },
          undefined,
          () => res(blankTexture),
        );
      }),
    );
  }
  return cache.get(url)!;
};

/** Procedural matcap: soft clay/plaster shading. */
export const makeMatcap = (hi = '#ffffff', mid = '#d9d6d3', lo = '#8e8a88', size = 256) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = lo;
  g.fillRect(0, 0, size, size);
  const r = size / 2;
  const grd = g.createRadialGradient(r * 0.72, r * 0.62, r * 0.05, r, r, r);
  grd.addColorStop(0, hi);
  grd.addColorStop(0.45, mid);
  grd.addColorStop(0.92, lo);
  grd.addColorStop(1, lo);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();
  // rim light
  const rim = g.createRadialGradient(r, r, r * 0.8, r, r, r);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = rim;
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
};

/** Loads the NUUKE logo (white on transparent) as a texture. */
export const logoTexture = () => loadTexture('/brand/nuuke-logo.png');
