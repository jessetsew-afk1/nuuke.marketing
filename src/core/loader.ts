import gsap from 'gsap';
import { $, $$ } from './dom';
import { audio } from './audio';
import { state, clamp } from './state';
import { initButtons } from './buttons';
import { loadTexture, logoTexture } from '../gl/assets';
import { PROJECTS } from '../data/projects';

/**
 * First-visit loader.
 * A dark screen with a tumbling NUUKE letter cube; a blush layer rises from
 * the bottom as assets load. At 100% the cube shrinks away, a pair of googly
 * eyes pops in and the Enter buttons appear. The eyes follow the pointer,
 * widen as it approaches Enter and turn into hearts on hover.
 */
export const runLoader = async (): Promise<void> => {
  const root = $('.loader');
  if (new URLSearchParams(location.search).has('skiploader')) {
    root.remove();
    document.body.classList.remove('is-loading');
    return;
  }
  initButtons(root);
  const progress = $('.loader__progress', root);
  const progressInner = $('.loader__progress-inner', root);
  const boxes = $$('.js-loader-box', root);
  const eyes = $<SVGSVGElement>('.loader__eyes', root);
  const enter = $('.loader__enter', root);
  const skip = $('.loader__skip', root);
  const pupils = $$<SVGGElement>('.js-pupil', root);
  const lidsTop = $$<SVGPathElement>('.js-lid-top', root);
  const lidsBottom = $$<SVGPathElement>('.js-lid-bottom', root);
  const normals = $$<SVGGElement>('.js-eye-normal', root);
  const hearts = $$<SVGPathElement>('.js-eye-heart', root);

  gsap.set([enter, skip], { autoAlpha: 0 });
  gsap.set(eyes, { scale: 0, transformOrigin: '50% 60%' });
  gsap.set(hearts, { scale: 0, transformOrigin: 'center center' });
  gsap.set([...lidsTop, ...lidsBottom], { y: 0 });

  // ---- progress
  const setProgress = (pct: number) => {
    progress.style.transform = `translateY(${100 - pct}%)`;
    progressInner.style.transform = `translateY(${-(100 - pct)}%)`;
  };
  setProgress(0);
  const jobs: Promise<unknown>[] = [
    document.fonts.ready,
    logoTexture(),
    ...PROJECTS.slice(0, 8).map((p) => loadTexture(p.cover)),
  ];
  let done = 0;
  jobs.forEach((j) => j.finally(() => setProgress((++done / jobs.length) * 100)));
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 7000))]);
  setProgress(100);
  await new Promise((r) => setTimeout(r, 1000));

  // ---- cube out, eyes in
  const eyelidTl = gsap
    .timeline({ paused: true })
    .to(lidsTop, { y: -80, ease: 'none' }, 0)
    .to(lidsBottom, { y: 72, ease: 'none' }, 0);
  gsap.to(boxes, { scale: 0, autoAlpha: 0, duration: 0.5, ease: 'power2.out', delay: 0.5 });
  gsap.to([enter, skip], { autoAlpha: 1, duration: 0.5, ease: 'power2.inOut', delay: 0.5 });
  let eyesShown = false;
  gsap.to(eyes, { scale: 1, duration: 1, ease: 'elastic.out(0.5, 0.4)', delay: 1, onComplete: () => (eyesShown = true) });
  gsap.to(eyelidTl, { progress: 1, duration: 0.5, ease: 'power3.out', delay: 1 });

  // ---- eyes follow the pointer; lids droop the further it is from Enter
  const cur = { x: 0, y: 0, dist: 0 };
  let hovering = false;
  const follow = () => {
    const e = eyes.getBoundingClientRect();
    const b = enter.getBoundingClientRect();
    const ex = e.left + e.width / 2;
    const ey = e.top + e.height / 2;
    const tx = clamp((state.mouse.x - ex) / (state.w * 0.5), -1, 1);
    const ty = clamp((state.mouse.y - ey) / (state.h * 0.5), -1, 1);
    const bx = (state.mouse.x - (b.left + b.width / 2)) / state.w;
    const by = (state.mouse.y - (b.top + b.height / 2)) / state.h;
    const dist = Math.sqrt(bx * bx + by * by) * 2;
    cur.x += (tx - cur.x) * 0.1;
    cur.y += (ty - cur.y) * 0.1;
    cur.dist += (dist - cur.dist) * 0.09;
    pupils.forEach((p) => p.setAttribute('transform', `translate(${cur.x * 20} ${cur.y * 22})`));
    if (!state.isTouch && eyesShown) {
      const open = hovering ? 1 : 1 - gsap.parseEase('power2.out')(clamp(cur.dist, 0, 1)) * 0.6;
      eyelidTl.progress(open);
    }
  };
  gsap.ticker.add(follow);
  enter.addEventListener('mouseenter', () => {
    hovering = true;
    gsap.to(normals, { scale: 0.2, duration: 0.3, transformOrigin: 'center center' });
    gsap.to(hearts, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.35)', delay: 0.1 });
  });
  enter.addEventListener('mouseleave', () => {
    hovering = false;
    gsap.to(hearts, { scale: 0, duration: 0.2 });
    gsap.to(normals, { scale: 1, duration: 0.3, transformOrigin: 'center center' });
  });

  const withSound = await new Promise<boolean>((resolve) => {
    enter.addEventListener('click', () => resolve(true), { once: true });
    skip.addEventListener('click', () => resolve(false), { once: true });
  });
  if (withSound) await audio.enable();

  // ---- hide: eyes out, loader fades, the blush layer zooms past the camera
  gsap.ticker.remove(follow);
  document.body.classList.remove('is-loading');
  audio.whoosh(1.4);
  gsap
    .timeline({ defaults: { ease: 'expo.inOut' }, onComplete: () => root.remove() })
    .to(eyes, { opacity: 0, duration: 0.5 }, 0)
    .to(root, { autoAlpha: 0, duration: 1 }, 0)
    .to(progressInner, { autoAlpha: 0, duration: 0.8 }, 0)
    .to(progressInner, { scale: 1.8, duration: 1.1 }, 0)
    .to([enter, skip], { autoAlpha: 0, duration: 0.3 }, 0);
  // the page starts entering while the loader is still dissolving
  await new Promise((r) => setTimeout(r, 300));
};
