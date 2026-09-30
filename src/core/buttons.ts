import gsap from 'gsap';
import { $$ } from './dom';

/**
 * Pill buttons with the reference hover: a fill rises from the bottom while
 * the label rolls down and out and a contrasting copy drops in from above.
 *
 * Markup: <a data-btn="fill-light|fill-dark|border-light|border-dark">Label</a>
 * Add data-btn-icon="none" to omit the arrow.
 */
const ARROW = `<svg class="btn__icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 3.5V10H3.5"/></svg>`;

export const initButtons = (root: ParentNode = document) => {
  $$('[data-btn]', root).forEach((el) => {
    if (el.dataset.btnReady) return;
    el.dataset.btnReady = '1';
    const label = el.textContent?.trim() ?? '';
    const icon = el.dataset.btnIcon === 'none' ? '' : ARROW;
    el.classList.add('btn', `btn--${el.dataset.btn}`);
    el.setAttribute('aria-label', el.getAttribute('aria-label') ?? label);
    el.innerHTML = `
      <span class="btn__inner">
        <span class="btn__fill"></span>
        <span class="btn__content" aria-hidden="true"><span class="btn__text">${label}</span>${icon}</span>
        <span class="btn__content btn__content--cloned" aria-hidden="true"><span class="btn__text">${label}</span>${icon}</span>
      </span>`;
    const [content, cloned] = $$('.btn__content', el);
    const fill = el.querySelector('.btn__fill')!;
    gsap.set(cloned, { yPercent: -120 });
    gsap.set(fill, { yPercent: 102 });
    const clonedIcon = cloned.querySelector('.btn__icon');
    if (clonedIcon) gsap.set(clonedIcon, { x: '-1.8rem' });

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.inOut', duration: 0.6 } });
    tl.to(content, { yPercent: 250 }, 0).to(cloned, { yPercent: 0, duration: 0.8 }, 0);
    const icn = content.querySelector('.btn__icon');
    if (icn) tl.to(icn, { xPercent: 200 }, 0).to(clonedIcon, { x: 0, duration: 0.8 }, 0);
    tl.to(fill, { yPercent: 0 }, 0);

    el.addEventListener('mouseenter', () => tl.play());
    el.addEventListener('mouseleave', () => tl.reverse());
    el.addEventListener('pointerdown', () => gsap.to(el, { scale: 0.94, duration: 0.15, ease: 'power2.out' }));
    const up = () => gsap.to(el, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
  });
};
