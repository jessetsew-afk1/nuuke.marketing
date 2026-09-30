import gsap from 'gsap';
import { $, $$, html, initRolls, splitChars } from '../core/dom';
import { CATEGORIES, PROJECTS, categoryCount, Category } from '../data/projects';
import { getProjectsScene } from '../gl/scenes';
import { cursor } from '../core/cursor';
import { audio } from '../core/audio';
import { events, state } from '../core/state';
import { navigate } from '../core/nav';
import type { Page } from './types';

export class ProjectsPage implements Page {
  scene = getProjectsScene();
  theme = 'light' as const;
  mood = 'light' as const;
  title = 'Projects';
  el: HTMLElement;
  private head: HTMLElement;
  private bar: HTMLElement;
  private offs: (() => void)[] = [];
  private drag = { active: false, moved: false, startY: 0, lastY: 0, vel: 0, id: -1 };
  private selecting = false;

  constructor() {
    this.el = html(`
      <section class="projects page-fixed">
        <div class="projects__head">
          <h1 class="projects__title">Selected Projects</h1>
          <div class="filters" role="tablist" aria-label="Filter projects">
            ${CATEGORIES.map(
              (c) => `<button class="filter${c.id === this.scene.filter ? ' is-active' : ''}" role="tab" data-filter="${c.id}">
                <span data-roll>${c.label}</span><sup>${categoryCount(c.id)}</sup></button>`,
            ).join('')}
          </div>
        </div>
        <div class="projects__hint"><span>Scroll</span><span class="projects__bar"><i></i></span></div>
        <nav class="projects__list" aria-label="All projects">
          <ul>${PROJECTS.map((p) => `<li><a href="/projects/${p.slug}" data-link>${p.client} — ${p.title}</a></li>`).join('')}</ul>
        </nav>
      </section>
    `);
    this.head = $('.projects__head', this.el);
    this.bar = $('.projects__bar i', this.el);
    initRolls(this.el);
  }

  enter({ first }: { first: boolean }) {
    const scene = this.scene;
    scene.resetAfterLeave();
    scene.scroll.current = scene.scroll.target = 0;
    requestAnimationFrame(() => {
      const f = $('.filters', this.el).getBoundingClientRect();
      scene.headerBottom = f.bottom;
      scene.layout(true);
      scene.playIntro(first ? 0.1 : 0.35);
    });
    scene.active = true;
    scene.onHover = (it) => {
      cursor.setLabel(it ? 'View' : null);
      if (it) audio.hover();
    };

    const chars = splitChars($('.projects__title', this.el));
    gsap.fromTo(
      chars,
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.025, delay: first ? 0.1 : 0.4 },
    );
    gsap.fromTo(
      $$('.filters, .projects__hint', this.el),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', delay: first ? 0.4 : 0.7, stagger: 0.1 },
    );

    $$('.filter', this.el).forEach((b) =>
      b.addEventListener('click', () => {
        $$('.filter', this.el).forEach((x) => x.classList.toggle('is-active', x === b));
        audio.click();
        scene.setFilter(b.dataset.filter as Category | 'all');
      }),
    );

    this.bindInput();
    this.offs.push(
      events.on('tick', () => {
        const s = scene.scroll;
        this.head.style.transform = `translate3d(0, ${-s.current * 0.9}px, 0)`;
        this.head.style.opacity = String(Math.max(0, 1 - s.current / 380));
        this.bar.style.transform = `scaleX(${s.max ? s.current / s.max : 0})`;
      }),
    );
  }

  private bindInput() {
    const scene = this.scene;
    const onWheel = (e: WheelEvent) => {
      if (state.menuOpen) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? state.h : 1;
      scene.addScroll(e.deltaY * unit);
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('a, button')) return;
      this.drag = { active: true, moved: false, startY: e.clientY, lastY: e.clientY, vel: 0, id: e.pointerId };
    };
    const onMove = (e: PointerEvent) => {
      const d = this.drag;
      if (!d.active || e.pointerId !== d.id) return;
      const dy = e.clientY - d.lastY;
      d.lastY = e.clientY;
      if (Math.abs(e.clientY - d.startY) > 6) {
        d.moved = true;
        if (!state.isTouch) cursor.setLabel('Drag');
      }
      if (d.moved) {
        d.vel = -dy * (state.isTouch ? 2.2 : 1.6);
        scene.addScroll(d.vel);
      }
    };
    const onUp = (e: PointerEvent) => {
      const d = this.drag;
      if (!d.active) return;
      d.active = false;
      if (d.moved) {
        scene.addScroll(d.vel * 12); // fling
        cursor.setLabel(scene.hovered ? 'View' : null);
        return;
      }
      const item = state.isTouch ? scene.itemAt(e.clientX, e.clientY) : scene.hovered;
      if (item) this.select(item.project.slug);
    };
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, number> = {
        ArrowDown: 120,
        ArrowUp: -120,
        PageDown: state.h * 0.8,
        PageUp: -state.h * 0.8,
        ' ': state.h * 0.8,
        Home: -1e6,
        End: 1e6,
      };
      if (map[e.key] !== undefined && !(e.target as Element).closest('input, textarea')) {
        e.preventDefault();
        scene.addScroll(map[e.key]);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    this.offs.push(() => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    });
  }

  private select(slug: string) {
    if (this.selecting) return;
    this.selecting = true;
    audio.click();
    cursor.setLabel(null);
    this.scene.playSelect(slug);
    setTimeout(() => navigate(`/projects/${slug}`), 450);
  }

  leave() {
    this.scene.active = false;
    this.scene.onHover = () => {};
    cursor.setLabel(null);
    this.offs.forEach((f) => f());
    this.offs = [];
    return new Promise<void>((resolve) => {
      gsap.to(this.el, { opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: resolve });
    });
  }

  destroy() {
    this.el.remove();
  }
}
