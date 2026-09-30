import gsap from 'gsap';
import { $, $$ } from './dom';
import { audio } from './audio';
import { state } from './state';

/**
 * Off-white panel that wipes in from the right (full screen below 1366px,
 * a right-hand panel above). Links assemble character by character; on hover
 * each link squeezes out and an italic copy squeezes in.
 */
class Menu {
  root = $('.menu');
  panel = $('.menu__panel', this.root);
  inner = $('.menu__inner', this.root);
  btn = $('.menu-toggle');
  items = $$<HTMLAnchorElement>('.menu__item', this.root);
  private openTl: gsap.core.Timeline | null = null;
  private hoverTls = new Map<HTMLElement, gsap.core.Timeline>();
  private animating = false;
  private closing: Promise<void> | null = null;
  private wide = matchMedia('(min-width: 1366px)');

  init() {
    this.items.forEach((item) => {
      this.split($('.menu__text', item));
      this.split($('.menu__hover', item));
    });
    this.resetPositions();
    this.buildHovers();

    this.btn.addEventListener('click', () => (state.menuOpen ? this.close() : this.open()));
    $('.menu__overlay', this.root).addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.menuOpen) this.close();
    });

    // toggle hover: dots spin, background pulses
    const icon = $('.menu-toggle__icon', this.btn);
    const bg = $('.menu-toggle__bg', this.btn);
    this.btn.addEventListener('mouseenter', () => {
      if (state.menuOpen) return;
      gsap.to(icon, { rotate: 180, duration: 0.5, ease: 'expo.inOut' });
      gsap.timeline().to(bg, { scale: 1.15, duration: 0.25, ease: 'none' }).to(bg, { scale: 1, duration: 0.25, ease: 'none' }, '<0.15');
    });
    this.btn.addEventListener('mouseleave', () => {
      if (state.menuOpen) return;
      gsap.to(icon, { rotate: 0, duration: 0.5, ease: 'expo.inOut' });
    });
  }

  private split(el: HTMLElement) {
    const text = el.textContent ?? '';
    el.textContent = '';
    [...text].forEach((c) => {
      const s = document.createElement('span');
      s.className = 'menu__char';
      s.textContent = c;
      el.appendChild(s);
    });
  }

  private chars(item: HTMLElement) {
    return $$('.menu__text .menu__char', item);
  }

  private resetPositions() {
    gsap.set(this.panel, { xPercent: 100 });
    gsap.set(this.inner, { xPercent: -100 });
    this.items.forEach((item, i) => {
      gsap.set(this.chars(item), { scaleX: 0, opacity: 0, x: (j: number) => `${j * (0.9 * j)}px` });
      gsap.set(item, { xPercent: 10 * (i + 1) });
    });
    gsap.set($$('.menu__hover .menu__char', this.root), { scaleX: 0, opacity: 0 });
    gsap.set($$('.menu__hover', this.root), { xPercent: -10 });
    gsap.set($$('.menu__underline', this.root), { width: 0, xPercent: 40 });
    gsap.set($('.menu__globe', this.root), { opacity: 0, scaleX: 0 });
    gsap.set($('.menu__contact a', this.root), { opacity: 0 });
  }

  private buildHovers() {
    this.items.forEach((item) => {
      const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.inOut', duration: 0.8 } });
      tl.to(this.chars(item), { scaleX: 0, opacity: 0, xPercent: 50, duration: 0.6, stagger: 0.03 })
        .to($$('.menu__hover .menu__char', item), { scaleX: 1, opacity: 1, duration: 0.6, stagger: 0.03 }, '<0.1')
        .to($('.menu__hover', item), { xPercent: 5 }, '<')
        .to($('.menu__num', item), { xPercent: 100 }, '<');
      const globe = item.querySelector('.menu__globe');
      if (globe) tl.to(globe, { xPercent: 40, yPercent: -40, scaleX: -1 }, '<');
      this.hoverTls.set(item, tl);

      item.addEventListener('mouseenter', () => {
        if (this.animating || item.classList.contains('is-active') || state.isTouch) return;
        if (!tl.isActive()) audio.hover();
        tl.play();
      });
      item.addEventListener('mouseleave', () => tl.reverse());
    });
  }

  private markActive() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    this.items.forEach((item) => {
      const href = item.getAttribute('href')!;
      const active = href === '/' ? path === '/' : path === href;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  open() {
    if (state.menuOpen || this.closing) return;
    state.menuOpen = true;
    this.animating = true;
    audio.click();
    audio.whoosh(0.9);
    this.markActive();
    this.resetPositions();
    document.body.classList.add('menu-open');
    this.root.classList.add('is-active');
    this.btn.setAttribute('aria-expanded', 'true');
    this.root.setAttribute('aria-hidden', 'false');
    const header = $('.header');
    if (!this.wide.matches) header.style.color = 'var(--ink)';

    const active = this.items.find((i) => i.classList.contains('is-active'));
    const tl = gsap.timeline({
      defaults: { ease: 'expo.inOut', duration: 1 },
      onComplete: () => (this.animating = false),
    });
    tl.to(this.panel, { xPercent: 0 }, 0)
      .to(this.inner, { xPercent: 0 }, 0)
      .to(this.items, { xPercent: 0 }, '<');
    if (active) tl.to($('.menu__underline', active), { width: '100%', xPercent: 0 }, '<');
    this.items.forEach((item) => tl.to(this.chars(item), { x: 0, opacity: 1, scaleX: 1, stagger: 0.02 }, '<'));
    tl.to($('.menu__globe', this.root), { opacity: 1, scaleX: 1 }, '<0.1')
      .to($$('.menu__contact a', this.root), { opacity: 1, stagger: 0.075 }, '<0.1')
      .to($('.header__nav'), { autoAlpha: 0, duration: 0.4 }, '<');

    // toggle: black fill grows, dots turn into a cross
    tl.to($('.menu-toggle__fill', this.btn), { scale: 1, duration: 1 }, 0)
      .to($('.menu-toggle__icon', this.btn), { scale: 0, rotate: 90, duration: 0.6 }, 0)
      .fromTo($('.menu-toggle__x', this.btn), { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.8 }, 0.25);
    this.openTl = tl;
  }

  close(fast = false): Promise<void> {
    if (this.closing) return this.closing;
    if (!state.menuOpen || !this.openTl) return Promise.resolve();
    state.menuOpen = false;
    this.animating = true;
    if (!fast) audio.click();
    this.hoverTls.forEach((t) => t.progress(0).pause());
    document.body.classList.remove('menu-open');
    this.btn.setAttribute('aria-expanded', 'false');
    this.root.setAttribute('aria-hidden', 'true');
    const tl = this.openTl;
    this.closing = new Promise<void>((resolve) => {
      tl.eventCallback('onReverseComplete', () => {
        this.root.classList.remove('is-active');
        $('.header').style.color = '';
        gsap.set($('.menu-toggle__icon', this.btn), { rotate: 0 });
        this.animating = false;
        this.closing = null;
        this.openTl = null;
        resolve();
      });
      tl.timeScale(fast ? 1.8 : 1.15).reverse();
    });
    return this.closing;
  }
}

export const menu = new Menu();
