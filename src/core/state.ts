type Handler = (payload?: any) => void;

class Emitter {
  private map = new Map<string, Set<Handler>>();
  on(evt: string, fn: Handler) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt)!.add(fn);
    return () => this.off(evt, fn);
  }
  off(evt: string, fn: Handler) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt: string, payload?: any) {
    this.map.get(evt)?.forEach((fn) => fn(payload));
  }
}

export const events = new Emitter();

export const state = {
  w: window.innerWidth,
  h: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 1.5),
  isTouch: matchMedia('(hover: none), (pointer: coarse)').matches,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  mouse: {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    /** -1..1, y up */
    nx: 0,
    ny: 0,
    vx: 0,
    vy: 0,
    down: false,
  },
  /** Smoothed mouse for camera parallax. */
  smooth: { nx: 0, ny: 0 },
  soundOn: false,
  menuOpen: false,
  route: '/',
};

export const isMd = () => state.w >= 768;

window.addEventListener('resize', () => {
  state.w = window.innerWidth;
  state.h = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  events.emit('resize');
});

let lastX = state.mouse.x;
let lastY = state.mouse.y;

const onMove = (x: number, y: number) => {
  state.mouse.x = x;
  state.mouse.y = y;
  state.mouse.nx = (x / state.w) * 2 - 1;
  state.mouse.ny = -((y / state.h) * 2 - 1);
};

window.addEventListener(
  'pointermove',
  (e) => {
    onMove(e.clientX, e.clientY);
    if (e.pointerType === 'mouse') state.isTouch = false;
  },
  { passive: true },
);
window.addEventListener('pointerdown', (e) => {
  onMove(e.clientX, e.clientY);
  state.mouse.down = true;
  state.isTouch = e.pointerType !== 'mouse';
});
window.addEventListener('pointerup', () => (state.mouse.down = false));
window.addEventListener('pointercancel', () => (state.mouse.down = false));

/** Called once per frame by the GL loop. */
export const tickInput = (dt: number) => {
  const k = Math.min(1, dt * 60);
  state.mouse.vx = (state.mouse.x - lastX) * k;
  state.mouse.vy = (state.mouse.y - lastY) * k;
  lastX = state.mouse.x;
  lastY = state.mouse.y;
  const s = 1 - Math.pow(0.001, dt * 0.9);
  state.smooth.nx += (state.mouse.nx - state.smooth.nx) * s;
  state.smooth.ny += (state.mouse.ny - state.smooth.ny) * s;
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Frame-rate independent damping. */
export const damp = (a: number, b: number, lambda: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));
