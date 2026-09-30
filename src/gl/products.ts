import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Project } from '../data/projects';

/**
 * Procedural 3D product stand-ins, one archetype per brand (squeeze bottle,
 * tin, cereal box, backpack …), wearing a label in the brand's colours.
 * Roughly 2 units tall and centred on the origin.
 */

const label = (p: Project, w = 1024, h = 512, opts: { vertical?: boolean; wrap?: boolean } = {}) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const [a, b, d] = [p.colors[0]?.hex ?? '#222', p.colors[1]?.hex ?? '#eee', p.colors[2]?.hex ?? '#888'];
  g.fillStyle = b;
  g.fillRect(0, 0, w, h);
  g.fillStyle = a;
  g.fillRect(0, h * 0.72, w, h * 0.28);
  g.fillStyle = d;
  g.fillRect(0, h * 0.68, w, h * 0.04);
  g.save();
  if (opts.vertical) {
    g.translate(w / 2, h / 2);
    g.rotate(-Math.PI / 2);
    g.translate(-h / 2, -w / 2);
  }
  const W = opts.vertical ? h : w;
  const H = opts.vertical ? w : h;
  g.fillStyle = a;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const name = p.client.toUpperCase();
  let size = Math.min(H * 0.3, ((opts.wrap ? W * 0.5 : W) * 1.5) / Math.max(4, name.length));
  g.font = `700 ${size}px "Inter Tight Variable", Arial, sans-serif`;
  // wrap-around labels only show about a third of their width from the front
  const room = opts.wrap ? W * 0.3 : W * 0.82;
  while (g.measureText(name).width > room && size > 10) {
    size -= 4;
    g.font = `700 ${size}px "Inter Tight Variable", Arial, sans-serif`;
  }
  g.fillText(name, W / 2, H * 0.38);
  g.font = `italic 400 ${Math.round(size * 0.32)}px "Playfair Display", Georgia, serif`;
  g.fillText(p.noun, W / 2, H * 0.56);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
};

const pattern = (p: Project, kind: 'rug' | 'knit') => {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const cols = p.colors.map((x) => x.hex);
  g.fillStyle = cols[1] ?? '#ddd';
  g.fillRect(0, 0, 512, 512);
  if (kind === 'rug') {
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = cols[i % cols.length];
      g.lineWidth = 18;
      g.strokeRect(20 + i * 28, 20 + i * 28, 472 - i * 56, 472 - i * 56);
    }
    g.fillStyle = cols[0];
    g.beginPath();
    g.moveTo(256, 150);
    g.lineTo(362, 256);
    g.lineTo(256, 362);
    g.lineTo(150, 256);
    g.fill();
  } else {
    for (let y = 0; y < 512; y += 16)
      for (let x = 0; x < 512; x += 16) {
        g.fillStyle = (x + y) % 32 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.ellipse(x + 8, y + 8, 7, 9, 0.5, 0, Math.PI * 2);
        g.fill();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

export const buildProduct = (p: Project): THREE.Group => {
  const g = new THREE.Group();
  const col = (i: number, fallback = '#cccccc') => new THREE.Color(p.colors[i]?.hex ?? fallback);
  const plastic = (c: THREE.Color, rough = 0.35) =>
    new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const metal = (c: THREE.Color, rough = 0.28) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.85 });
  const printed = (tex: THREE.Texture, rough = 0.45) => new THREE.MeshPhysicalMaterial({ map: tex, roughness: rough, clearcoat: 0.3 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const lathe = (pts: [number, number][], seg = 64) =>
    new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

  switch (p.model) {
    case 'bottle': {
      add(
        lathe([
          [0, -1.05], [0.42, -1.05], [0.46, -0.98], [0.46, 0.35], [0.4, 0.6], [0.24, 0.78], [0.16, 0.86],
          [0.16, 0.95], [0, 0.95],
        ]),
        plastic(col(0, '#2f5d3a')),
      );
      add(lathe([[0, 0.93], [0.17, 0.93], [0.15, 1.08], [0.05, 1.22], [0, 1.24]]), plastic(col(2, '#f4efe2'), 0.5));
      add(new THREE.CylinderGeometry(0.465, 0.465, 0.95, 64, 1, true), printed(label(p, 1024, 400, { wrap: true })), 0, -0.35, 0).rotation.y = Math.PI;
      break;
    }
    case 'can': {
      add(new THREE.CylinderGeometry(0.46, 0.46, 1.6, 64, 1, true), printed(label(p, 1024, 512, { wrap: true }))).rotation.y = Math.PI;
      add(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 64), metal(new THREE.Color('#c9c9c9')), 0, 0.84, 0);
      add(new THREE.CylinderGeometry(0.46, 0.42, 0.08, 64), metal(new THREE.Color('#c9c9c9')), 0, -0.84, 0);
      break;
    }
    case 'tin': {
      const s = new THREE.Shape();
      const w = 1.6;
      const h = 1.05;
      const r = 0.22;
      s.moveTo(-w / 2 + r, -h / 2);
      s.lineTo(w / 2 - r, -h / 2);
      s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      s.lineTo(w / 2, h / 2 - r);
      s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      s.lineTo(-w / 2 + r, h / 2);
      s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      s.lineTo(-w / 2, -h / 2 + r);
      s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 });
      geo.center();
      add(geo, metal(col(0, '#f2c6d2'), 0.35));
      const lid = add(new THREE.PlaneGeometry(w * 0.9, h * 0.86), printed(label(p, 1024, 560)), 0, 0, 0.21);
      lid.renderOrder = 1;
      g.rotation.x = -0.25;
      g.scale.setScalar(1.25);
      break;
    }
    case 'pouch':
    case 'box': {
      const box = p.model === 'box';
      const geo = new RoundedBoxGeometry(box ? 1.35 : 1.15, box ? 1.9 : 1.6, box ? 0.5 : 0.22, 6, box ? 0.05 : 0.1);
      add(geo, plastic(col(1, '#eee'), box ? 0.6 : 0.3));
      add(new THREE.PlaneGeometry(box ? 1.25 : 1.02, box ? 1.8 : 1.4), printed(label(p, 640, 900, { vertical: false })), 0, 0, (box ? 0.25 : 0.115) + 0.002);
      if (!box) add(new THREE.BoxGeometry(1.1, 0.08, 0.1), plastic(col(0)), 0, 0.82, 0);
      break;
    }
    case 'jar': {
      add(lathe([[0, -0.55], [0.62, -0.55], [0.66, -0.48], [0.66, 0.3], [0.6, 0.36], [0, 0.36]]), plastic(col(1, '#f5f5f5'), 0.15));
      add(new THREE.CylinderGeometry(0.64, 0.64, 0.34, 64), plastic(col(0), 0.3), 0, 0.53, 0);
      add(new THREE.CylinderGeometry(0.665, 0.665, 0.5, 64, 1, true), printed(label(p, 1024, 320, { wrap: true })), 0, -0.12, 0).rotation.y = Math.PI;
      g.scale.setScalar(1.3);
      break;
    }
    case 'tube': {
      add(lathe([[0, -0.7], [0.3, -0.7], [0.32, -0.6], [0.32, 0.55], [0.22, 0.9], [0.02, 1.02], [0, 1.02]]), plastic(col(0), 0.3));
      add(new THREE.CylinderGeometry(0.33, 0.33, 0.45, 48), plastic(col(2, '#fff'), 0.25), 0, -0.93, 0);
      add(new THREE.CylinderGeometry(0.325, 0.325, 0.9, 48, 1, true), printed(label(p, 1024, 420, { wrap: true })), 0, 0, 0).rotation.y = Math.PI;
      break;
    }
    case 'compact': {
      add(new THREE.CylinderGeometry(0.85, 0.85, 0.24, 64), plastic(col(0), 0.25), 0, -0.2, 0);
      const lid = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.14, 64), plastic(col(0), 0.25));
      top.position.z = 0.85;
      const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.72, 48), metal(new THREE.Color('#e8e8e8'), 0.05));
      mirror.rotation.x = Math.PI / 2;
      mirror.position.set(0, -0.08, 0.85);
      lid.add(top, mirror);
      lid.position.set(0, -0.08, -0.85);
      lid.rotation.x = -1.2;
      g.add(lid);
      add(new THREE.CircleGeometry(0.66, 48), plastic(col(1, '#e8c4b0'), 0.8), 0, -0.07, 0).rotation.x = -Math.PI / 2;
      break;
    }
    case 'rug': {
      const tex = pattern(p, 'rug');
      const roll = add(new THREE.CylinderGeometry(0.34, 0.34, 2.2, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), 0, 0.2, -0.6);
      roll.rotation.z = Math.PI / 2;
      const flat = add(new THREE.BoxGeometry(2.2, 0.04, 1.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), 0, -0.13, 0.45);
      flat.rotation.x = 0.02;
      g.rotation.x = 0.45;
      break;
    }
    case 'blanket': {
      const tex = pattern(p, 'knit');
      tex.repeat.set(10, 2);
      add(new THREE.TorusKnotGeometry(0.62, 0.3, 220, 32, 2, 3), new THREE.MeshStandardMaterial({ color: col(0), map: tex, roughness: 0.95 }));
      break;
    }
    case 'oven': {
      const body = metal(new THREE.Color('#2a2a2a'), 0.45);
      add(new RoundedBoxGeometry(1.8, 0.8, 1.4, 6, 0.18), body, 0, 0, 0);
      add(new RoundedBoxGeometry(1.1, 0.34, 0.2, 4, 0.08), new THREE.MeshStandardMaterial({ color: '#0b0b0b', roughness: 1 }), 0, -0.08, 0.66);
      add(new THREE.PlaneGeometry(1.0, 0.24), new THREE.MeshBasicMaterial({ color: '#ff7b2e' }), 0, -0.1, 0.771);
      add(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 32), body, 0.45, 0.72, -0.35);
      [-0.7, 0.7].forEach((x) => add(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 16), body, x, -0.55, 0.4));
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.35, 16), body, 0, -0.55, -0.55);
      break;
    }
    case 'stack': {
      for (let i = 0; i < 5; i++) {
        const m = add(
          new RoundedBoxGeometry(1.5, 0.26, 1.05, 6, 0.1),
          new THREE.MeshStandardMaterial({ color: col(i % p.colors.length), roughness: 0.95 }),
          (Math.sin(i * 2.3) * 0.06),
          -0.6 + i * 0.28,
          Math.cos(i * 1.7) * 0.05,
        );
        m.rotation.y = Math.sin(i * 1.9) * 0.12;
      }
      break;
    }
    case 'backpack': {
      const fabric = new THREE.MeshStandardMaterial({ color: col(0), roughness: 0.85 });
      const trim = new THREE.MeshStandardMaterial({ color: col(1, '#333'), roughness: 0.8 });
      add(new RoundedBoxGeometry(1.2, 1.75, 0.6, 8, 0.26), fabric);
      add(new RoundedBoxGeometry(0.9, 0.7, 0.22, 6, 0.1), trim, 0, -0.38, 0.36);
      const handle = add(new THREE.TorusGeometry(0.16, 0.035, 12, 32, Math.PI), trim, 0, 0.9, 0);
      handle.rotation.y = Math.PI / 2;
      [-0.35, 0.35].forEach((x) => add(new RoundedBoxGeometry(0.16, 1.4, 0.08, 4, 0.04), trim, x, 0, -0.34));
      add(new THREE.PlaneGeometry(0.46, 0.2), printed(label(p, 512, 220)), 0, 0.22, 0.305);
      break;
    }
    case 'wallet': {
      const plate = metal(col(0, '#1a1a1a'), 0.35);
      add(new RoundedBoxGeometry(1.7, 1.05, 0.06, 4, 0.03), plate, 0, 0, 0.22);
      add(new RoundedBoxGeometry(1.7, 1.05, 0.06, 4, 0.03), plate, 0, 0, -0.22);
      for (let i = 0; i < 5; i++) {
        add(new THREE.BoxGeometry(1.6, 1.0, 0.03), new THREE.MeshStandardMaterial({ color: col(i % p.colors.length), roughness: 0.4 }), 0, 0.12 + i * 0.03, -0.14 + i * 0.07);
      }
      add(new THREE.BoxGeometry(0.28, 1.1, 0.52), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.9 }), 0.5, 0, 0);
      g.rotation.x = 0.35;
      break;
    }
    case 'band': {
      const strap = add(new THREE.TorusGeometry(0.72, 0.1, 24, 96), new THREE.MeshStandardMaterial({ color: col(0, '#111'), roughness: 0.8 }));
      strap.scale.set(1, 1, 2.2);
      add(new RoundedBoxGeometry(0.62, 0.22, 0.44, 6, 0.08), metal(new THREE.Color('#1d1d1d'), 0.3), 0, 0.76, 0);
      add(new THREE.PlaneGeometry(0.3, 0.06), new THREE.MeshBasicMaterial({ color: col(2, '#00f19f') }), 0, 0.875, 0.221);
      g.rotation.x = 0.5;
      break;
    }
  }
  return g;
};
