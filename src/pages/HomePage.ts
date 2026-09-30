import gsap from 'gsap';
import { $, $$, html, splitChars } from '../core/dom';
import { getHomeScene } from '../gl/scenes';
import { events } from '../core/state';
import type { Page } from './types';

const globe = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18M5 7.5h14M5 16.5h14"/></svg>`;

/** Index and Contact share one WebGL scene; switching between them animates the camera. */
export class HomePage implements Page {
  scene = getHomeScene();
  theme = 'light' as const;
  mood = 'bright' as const;
  title: string;
  el: HTMLElement;
  private offs: (() => void)[] = [];

  constructor(private mode: 'home' | 'contact') {
    this.title = mode === 'home' ? 'Index' : 'Contact';
    this.el = mode === 'home' ? this.homeMarkup() : this.contactMarkup();
  }

  private homeMarkup() {
    return html(`
      <section class="home">
        <h1 style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">NUUKE — social-first marketing studio for TikTok, Reels, UGC and paid social</h1>
        <a class="home__cta btn--sm" href="/projects" data-link data-btn="fill-light">View our work</a>
        <a class="home__wrapped" href="/world" data-link data-btn="border-light" data-btn-icon="none">Our 2026 Wrapped</a>
        <a class="world-btn" href="/world" data-link aria-label="Explore the NUUKE world">${globe}</a>
        <span class="home__cr">©2026</span>
      </section>
    `);
  }

  private contactMarkup() {
    return html(`
      <section class="contact">
        <div class="contact__inner">
          <div class="contact__intro">
            <h1 class="contact__title t-serif-i">Say hello</h1>
            <p class="contact__sub">We look forward<br />to hearing from you</p>
          </div>
          <div class="contact__info">
            <div class="contact__toggles" role="tablist">
              <button type="button" class="contact__toggle is-active" data-panel="business" role="tab" aria-selected="true">New Business</button>
              <button type="button" class="contact__toggle" data-panel="general" role="tab" aria-selected="false">General</button>
            </div>
            <div class="contact__panel is-active" data-panel="business">
              <a href="mailto:jesse@nuuke.us" data-roll>jesse@nuuke.us</a>
              <a href="tel:+13076556344" data-roll>+1 307 655 6344</a>
            </div>
            <div class="contact__panel" data-panel="general">
              <a href="mailto:walter@nuuke.us" data-roll>walter@nuuke.us</a>
              <a href="tel:+13076556344" data-roll>+1 307 655 6344</a>
            </div>
            <form class="contact__form" novalidate>
              <input type="email" name="email" placeholder="Your email" aria-label="Your email" required />
              <button type="submit" data-btn="fill-dark">Let's talk</button>
            </form>
          </div>
        </div>
      </section>
    `);
  }

  enter({ first }: { first: boolean }) {
    const scene = this.scene;
    scene.setMode(this.mode, !first);
    if (first || !scene.introPlayed) scene.playIntro(first ? 0 : 0.4);
    const d = first ? 1.1 : 0.6;

    if (this.mode === 'home') {
      gsap.fromTo(
        $$('.home__cta, .home__wrapped, .world-btn, .home__cr', this.el),
        { opacity: 0 },
        { opacity: 1, duration: 1.4, ease: 'power2.out', stagger: 0.08, delay: d + (first ? 1.6 : 0.8) },
      );
      // the CTA pill follows the floating logo as the camera moves
      const cta = $('.home__cta', this.el);
      this.offs.push(
        events.on('tick', () => {
          const p = scene.ctaPosition();
          cta.style.left = `${p.x - cta.offsetWidth / 2}px`;
          cta.style.top = `${p.y - cta.offsetHeight / 2}px`;
        }),
      );
    } else {
      const chars = splitChars($('.contact__title', this.el));
      $$('.contact__toggle', this.el).forEach((b) =>
        b.addEventListener('click', () => {
          $$('.contact__toggle', this.el).forEach((x) => {
            x.classList.toggle('is-active', x === b);
            x.setAttribute('aria-selected', String(x === b));
          });
          $$('.contact__panel', this.el).forEach((p) => p.classList.toggle('is-active', p.dataset.panel === b.dataset.panel));
        }),
      );
      gsap.fromTo(
        chars,
        { yPercent: 105, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: 0.03, delay: d },
      );
      gsap.fromTo(
        $$('.contact__sub, .contact__toggles, .contact__panel.is-active, .contact__form', this.el),
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07, delay: d + 0.3 },
      );
      const form = $<HTMLFormElement>('.contact__form', this.el);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $<HTMLInputElement>('input', form);
        if (!input.value.includes('@')) {
          input.focus();
          gsap.fromTo(input, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
          return;
        }
        // No backend yet: hook this up to your CRM / form service.
        form.innerHTML = `<p style="margin:0 auto;font-size:15px">Thanks — we'll be in touch within 24 hours.</p>`;
      });
    }
  }

  leave() {
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
