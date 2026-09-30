import './styles/main.css';
import { initRolls } from './core/dom';
import { initButtons } from './core/buttons';
import { audio } from './core/audio';
import { cursor } from './core/cursor';
import { menu } from './core/menu';
import { router } from './core/router';
import { runLoader } from './core/loader';
import { gl } from './gl/gl';
import { getCaseScene, getHomeScene, getProjectsScene, getWorldScene } from './gl/scenes';

if (import.meta.env.DEV) {
  import('gsap').then((m) => ((window as any).__gsap = m.default));
  import('./dev/audit');
}

gl.init();
audio.init();
cursor.init();
menu.init();
initRolls(document);
initButtons(document.querySelector('.header')!);
router.init();

const first = router.mountFirst();
runLoader().then(() => {
  first.enter({ first: true });
  // While the visitor looks at the first page, quietly build, compile and
  // upload the other scenes one at a time so later transitions stay smooth.
  const idle = (fn: () => void) =>
    'requestIdleCallback' in window ? (window as any).requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 200);
  const queue = [getProjectsScene, getHomeScene, getWorldScene, getCaseScene];
  const next = () => {
    const make = queue.shift();
    if (!make) return;
    idle(() => {
      gl.prewarm(make());
      setTimeout(next, 600);
    });
  };
  setTimeout(next, 2500);
});
