import gsap from 'gsap';
import { $, html } from '../core/dom';
import { getWorldScene } from '../gl/scenes';
import type { WorldItem } from '../gl/scenes/WorldScene';
import { cursor } from '../core/cursor';
import { audio } from '../core/audio';
import { state } from '../core/state';
import type { Page } from './types';

const chevron = (d: string) =>
  `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="${d}" /></svg>`;

export class WorldPage implements Page {
  scene = getWorldScene();
  theme = 'dark' as const;
  mood = 'dark' as const;
  title = 'World';
  el: HTMLElement;
  private offs: (() => void)[] = [];
  private details: HTMLElement;
  private nav: HTMLElement;

  constructor() {
    this.el = html(`
      <section class="world page-fixed">
        <h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">NUUKE World</h1>
        <div class="world__count"><span class="js-count">${this.scene.media.length}</span> pieces of content</div>
        <div class="world__details" aria-live="polite">
          <p class="meta js-meta"></p>
          <h2 class="js-title"></h2>
          <p class="js-caption"></p>
          <a class="js-link" href="/" data-link data-btn="fill-light">View case study</a>
        </div>
        <div class="world__nav">
          <button type="button" class="js-prev" aria-label="Previous">${chevron('M9 2L4 7l5 5')}</button>
          <button type="button" class="js-close" aria-label="Close">${chevron('M3 3l8 8M11 3l-8 8')}</button>
          <button type="button" class="js-next" aria-label="Next">${chevron('M5 2l5 5-5 5')}</button>
        </div>
        <div class="world__hint">
          <svg viewBox="0 0 14 14"><path d="M7 1v12M1 7h12M7 1L5 3M7 1l2 2M7 13l-2-2M7 13l2-2M1 7l2-2M1 7l2 2M13 7l-2-2M13 7l-2 2"/></svg>
          <span>Drag to explore our world</span>
        </div>
      </section>
    `);
    this.details = $('.world__details', this.el);
    this.nav = $('.world__nav', this.el);
  }

  enter() {
    const s = this.scene;
    s.active = true;
    s.onHover = (it) => {
      cursor.setLabel(it ? 'View' : null);
      if (it) audio.hover();
    };
    s.onOpen = (it) => this.showDetails(it);
    gsap.set([this.details, this.nav], { autoAlpha: 0 });
    gsap.fromTo(
      [$('.world__hint', this.el), $('.world__count', this.el)],
      { opacity: 0 },
      { opacity: 0.7, duration: 1.2, delay: s.visited ? 0.6 : 3.8 },
    );
    s.playIntro();
    this.bind();
  }

  private showDetails(it: WorldItem | null) {
    if (!it) {
      gsap.to([this.details, this.nav], { autoAlpha: 0, duration: 0.4 });
      return;
    }
    const p = it.media.project;
    $('.js-meta', this.el).textContent =
      it.media.kind === 'campaign' ? `${p.client} · ${p.year}` : `${p.client} · ${p.title}`;
    $('.js-title', this.el).textContent = p.title;
    $('.js-caption', this.el).textContent = it.media.kind === 'campaign' ? p.summary : p.description;
    $<HTMLAnchorElement>('.js-link', this.el).href = `/projects/${p.slug}`;
    gsap.fromTo(
      [this.details, this.nav],
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', delay: 0.35, stagger: 0.06 },
    );
  }

  private bind() {
    const s = this.scene;
    let down = false;
    let moved = false;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    const mult = () => (state.isTouch ? 2.2 : 1.3);

    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('a, button, .header, .menu')) return;
      down = true;
      moved = false;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        if (s.open) {
          down = false;
          return;
        }
        moved = true;
        s.drag.active = true;
        cursor.setLabel('Drag');
        gsap.to(s.drag.strength, { v: 1, duration: 0.75, ease: 'power2.out', overwrite: true });
      }
      if (moved) {
        s.drag.x += dx * mult();
        s.drag.y -= dy * mult();
        s.drag.vx = dx * mult();
        s.drag.vy = -dy * mult();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      if (moved) {
        s.drag.active = false;
        cursor.setLabel(null);
        gsap.to(s.drag.strength, { v: 0, duration: 1, ease: 'expo.out', overwrite: true });
        return;
      }
      const it = s.pick(e.clientX, e.clientY);
      if (it && !s.open) {
        audio.click();
        cursor.setLabel(null);
        s.openItem(it);
      } else if (s.open) {
        s.closeItem();
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (s.open) return;
      s.drag.vx -= e.deltaX * 0.08;
      s.drag.vy += e.deltaY * 0.08;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') s.closeItem();
      if (e.key === 'ArrowRight') s.open ? s.step(1) : (s.drag.vx -= 20);
      if (e.key === 'ArrowLeft') s.open ? s.step(-1) : (s.drag.vx += 20);
      if (e.key === 'ArrowUp' && !s.open) s.drag.vy -= 20;
      if (e.key === 'ArrowDown' && !s.open) s.drag.vy += 20;
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    $('.js-prev', this.el).addEventListener('click', () => s.step(-1));
    $('.js-next', this.el).addEventListener('click', () => s.step(1));
    $('.js-close', this.el).addEventListener('click', () => s.closeItem());
    this.offs.push(() => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    });
  }

  leave() {
    const s = this.scene;
    s.active = false;
    s.onHover = () => {};
    s.onOpen = () => {};
    if (s.open) s.closeItem();
    cursor.setLabel(null);
    this.offs.forEach((f) => f());
    return new Promise<void>((resolve) =>
      gsap.to(this.el, { opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: resolve }),
    );
  }

  destroy() {
    this.el.remove();
  }
}
