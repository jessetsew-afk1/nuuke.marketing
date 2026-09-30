import './styles/main.css';
import { initRolls } from './core/dom';
import { initButtons } from './core/buttons';
import { audio } from './core/audio';
import { cursor } from './core/cursor';
import { menu } from './core/menu';
import { router } from './core/router';
import { runLoader } from './core/loader';
import { gl } from './gl/gl';

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
runLoader().then(() => first.enter({ first: true }));
