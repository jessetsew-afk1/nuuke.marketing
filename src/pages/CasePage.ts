import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { $, $$, html, splitLines } from '../core/dom';
import { PROJECTS, getProject, Project, Category } from '../data/projects';
import { getCaseScene } from '../gl/scenes';
import { cursor } from '../core/cursor';
import { navigate } from '../core/nav';
import { clamp, state } from '../core/state';
import {
  heroHTML,
  chapterHTML,
  strategyDocs,
  blueprints,
  scripts,
  reels,
  adVariants,
  identityDocs,
  productionDocs,
  creatorRoster,
  resultsHTML,
  mosaicHTML,
  nextHTML,
} from './case/modules';
import type { Page } from './types';

gsap.registerPlugin(ScrollTrigger);

const formatKpi = (v: number, k: Project['kpis'][number]) =>
  `${k.prefix ?? ''}${v.toFixed(k.decimals ?? 0)}${k.suffix ?? ''}`;

/** Chapter copy + work module for each service a project includes. */
const serviceChapter = (p: Project, c: Category): [string, [string, string], string, string] => {
  switch (c) {
    case 'ugc':
      return [
        'UGC',
        ['Creator', 'Blueprints'],
        `Every ${p.noun} video was planned before a creator pressed record: frame-by-frame blueprints for the hook, the demo and the proof, then scripts written to sound like the creator, not the brand.`,
        blueprints(p) + scripts(p),
      ];
    case 'paid-ads':
      return [
        'Paid Ads',
        ['Test &', 'Scale'],
        'Every concept shipped as four variants, one variable at a time. Losers were cut within 72 hours; winners were scaled, remixed and fed back into the next brief.',
        adVariants(p),
      ];
    case 'branding':
      return [
        'Branding',
        ['Identity', 'System'],
        `We codified ${p.client}’s identity for social: construction rules for the mark, a documented colour system and a type scale built for small screens.`,
        identityDocs(p),
      ];
    case 'content':
      return [
        'Content Creation',
        ['In', 'Production'],
        'A production system built for volume: one call sheet, one shoot day, forty-plus assets. Every shot was mapped to a platform and a placement before the camera rolled.',
        productionDocs(p),
      ];
    case 'influencer':
      return [
        'Influencer',
        ['Creator', 'Program'],
        `We cast creators whose audiences already overlap with ${p.client}’s, then briefed them loosely enough to sound like themselves.`,
        creatorRoster(p),
      ];
  }
};

const TIKTOK = (id: string) =>
  `https://www.tiktok.com/player/v1/${id}?autoplay=1&loop=1&controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`;

export class CasePage implements Page {
  scene = getCaseScene();
  theme = 'dark' as const;
  mood = 'light' as const;
  title: string;
  el: HTMLElement;
  private p: Project;
  private next: Project;
  private lenis: Lenis | null = null;
  private tickers: ((t: number) => void)[] = [];
  private offs: (() => void)[] = [];
  private leaving = false;

  constructor(slug: string) {
    this.p = getProject(slug)!;
    const i = PROJECTS.indexOf(this.p);
    this.next = PROJECTS[(i + 1) % PROJECTS.length];
    this.title = `${this.p.client} — ${this.p.title}`;
    this.el = this.markup();
  }

  private markup() {
    const p = this.p;
    let n = 1;
    const chapters = [
      chapterHTML(n++, 'The brief', ['The', 'Brief'], p.challenge),
      chapterHTML(n++, 'Strategy', ['The', 'Strategy'], p.approach, strategyDocs(p)),
      ...p.categories.map((c) => {
        const [kicker, title, body, inner] = serviceChapter(p, c);
        return chapterHTML(n++, kicker, title, body, inner);
      }),
    ];
    return html(`
      <article class="cs page">
        <div class="cs-label t-label" aria-hidden="true">${p.client} &amp; NUUKE</div>
        ${heroHTML(p)}
        <figure class="cs-full"><img src="${p.cover}" alt="${p.client}" crossorigin="anonymous" /></figure>
        ${chapters.join('')}
        ${reels(p)}
        ${mosaicHTML(p)}
        ${resultsHTML(p)}
        ${nextHTML(this.next)}
        <div class="progress" aria-hidden="true"><i></i></div>
      </article>
    `);
  }

  enter() {
    document.documentElement.dataset.scroll = 'native';
    window.scrollTo(0, 0);
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    this.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    const header = $('.header');
    const label = $('.cs-label', this.el);
    lenis.on('scroll', (l: Lenis) => {
      const hide = l.direction === 1 && l.scroll > 200;
      header.classList.toggle('is-hidden', hide);
      label.classList.toggle('is-hidden', hide);
    });
    // runs first each frame, so scroll-linked visuals and WebGL read the same position
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf, false, true);
    this.tickers.push(raf);

    this.scene.set([
      { project: this.p, anchor: $('.js-model-anchor', this.el) },
      { project: this.next, anchor: $('.js-next-anchor', this.el) },
    ]);

    this.animateHero();
    // build the scroll animations after the page transition has settled
    window.setTimeout(() => {
      if (!this.el.isConnected) return;
      this.animateSections();
      ScrollTrigger.refresh();
    }, 700);
    this.initReels();
    this.initNext();
  }

  private animateHero() {
    const tl = gsap.timeline({ delay: 0.45 });
    tl.fromTo(
      $$('.cs-hero__title h1 > span, .cs-hero__kind > span', this.el),
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: 0.08 },
    )
      .fromTo($('.cs-label', this.el), { opacity: 0 }, { opacity: 1, duration: 1 }, 0.2)
      .fromTo(
        splitLines($('.cs-hero__overview .js-lines', this.el)),
        { yPercent: 105 },
        { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06 },
        0.4,
      )
      .fromTo(
        $$('.cs-hero__overview .t-label, .cs-hero__facts > div, .cs-hero__visit', this.el),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.07 },
        0.5,
      );
  }

  private animateSections() {
    const el = this.el;
    // full-bleed image opens up
    const full = $('.cs-full', el);
    gsap.fromTo(
      full,
      { clipPath: 'inset(14% 12% 14% 12% round 10px)' },
      { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none', scrollTrigger: { trigger: full, start: 'top bottom', end: 'center center', scrub: true } },
    );
    gsap.fromTo($('img', full), { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: full, start: 'top bottom', end: 'bottom top', scrub: true } });

    // chapter titles + copy
    $$('.cs-chapter__title', el).forEach((t) =>
      gsap.fromTo(t.children, { yPercent: 110, opacity: 0 }, {
        yPercent: 0,
        opacity: 1,
        duration: 1.3,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: t, start: 'top 85%' },
      }),
    );
    $$('.reveal', el).forEach((r) =>
      gsap.fromTo(r, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: r, start: 'top 90%' } }),
    );

    // documents: fly in tilted, settle as you scroll, parallax per card
    // One timeline per card driven by a single ScrollTrigger (settle, then drift),
    // so no two animations ever fight over the same property.
    $$('.js-doc', el).forEach((d, i) => {
      const r = parseFloat(getComputedStyle(d).getPropertyValue('--r')) || 0;
      gsap
        .timeline({ scrollTrigger: { trigger: d, start: 'top bottom', end: 'bottom top', scrub: true } })
        .fromTo(
          d,
          { rotateX: 38, rotateZ: r * 3, y: 160, opacity: 0, transformPerspective: 1400, force3D: true },
          { rotateX: 6, rotateZ: r, y: 0, opacity: 1, ease: 'power2.out', duration: 0.45 },
        )
        .to(d, { y: -40 - (i % 3) * 30, ease: 'none', duration: 0.55 });
    });

    // blueprint plane leans back as it scrolls through
    $$('.bp-plane', el).forEach((b) =>
      gsap.fromTo(b, { rotateX: 52, rotateZ: -14, scale: 1.25, transformPerspective: 1200 }, {
        rotateX: 28,
        rotateZ: -8,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: b.parentElement!, start: 'top bottom', end: 'bottom top', scrub: true },
      }),
    );

    // mosaic: an isometric wall of brand imagery that straightens as it scrolls
    const plane = $('.cs-mosaic__plane', el);
    gsap.fromTo(plane, { rotate: -16, skewX: 14, yPercent: 6 }, {
      rotate: -10,
      skewX: 8,
      yPercent: -18,
      ease: 'none',
      scrollTrigger: { trigger: plane.parentElement!, start: 'top bottom', end: 'bottom top', scrub: true },
    });

    // KPIs
    $$('[data-kpi]', el).forEach((k) => {
      const kpi = this.p.kpis[Number(k.dataset.kpi)];
      const o = { v: 0 };
      gsap.to(o, {
        v: kpi.value,
        duration: 2.2,
        ease: 'expo.out',
        onUpdate: () => (k.textContent = formatKpi(o.v, kpi)),
        scrollTrigger: { trigger: k, start: 'top 90%' },
      });
    });

    gsap.to($('.progress i', el), {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom bottom', scrub: true },
    });
  }

  /** TikTok players load when their row approaches the viewport and autoplay muted. */
  private initReels() {
    const track = $('.cs-reels__track', this.el);
    const frames = $$('.js-reel', this.el);
    if (frames.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const f = e.target as HTMLElement;
            const iframe = f.querySelector('iframe');
            if (e.isIntersecting && !iframe) {
              const frame = document.createElement('iframe');
              frame.src = TIKTOK(f.dataset.video!);
              frame.title = `${this.p.client} TikTok`;
              frame.allow = 'autoplay; encrypted-media; picture-in-picture';
              frame.loading = 'lazy';
              frame.referrerPolicy = 'strict-origin-when-cross-origin';
              frame.addEventListener('load', () => f.classList.add('is-loaded'));
              $('.reel__screen', f).appendChild(frame);
            }
            if (iframe) {
              iframe.contentWindow?.postMessage({ 'x-tiktok-player': true, type: e.isIntersecting ? 'play' : 'pause' }, '*');
            }
          });
        },
        { rootMargin: '300px 0px' },
      );
      frames.forEach((f) => io.observe(f));
      // TikTok reports videos it won't play in embeds (licensed audio, region
      // locks); drop those frames instead of showing "unavailable".
      const onMessage = (e: MessageEvent) => {
        if (!String(e.origin).includes('tiktok.com')) return;
        let data: any = e.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (data?.type !== 'onPlayerError') return;
        const f = frames.find((fr) => fr.querySelector('iframe')?.contentWindow === e.source);
        if (!f) return;
        io.unobserve(f);
        gsap.to(f, {
          opacity: 0,
          width: 0,
          marginRight: -14,
          duration: 0.6,
          ease: 'power2.inOut',
          onComplete: () => f.remove(),
        });
      };
      window.addEventListener('message', onMessage);
      this.offs.push(() => {
        io.disconnect();
        window.removeEventListener('message', onMessage);
      });
    }
    // drag / wheel-less horizontal scroll with inertia
    let down = false;
    let sx = 0;
    let start = 0;
    track.addEventListener('pointerenter', () => cursor.setLabel('Drag'));
    track.addEventListener('pointerleave', () => cursor.setLabel(null));
    track.addEventListener('pointerdown', (e) => {
      down = true;
      sx = e.clientX;
      start = track.scrollLeft;
    });
    const move = (e: PointerEvent) => {
      if (down) track.scrollLeft = start - (e.clientX - sx) * 1.4;
    };
    const up = () => (down = false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    this.offs.push(() => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    });
  }

  /** Keep scrolling past the end to open the next project. */
  private initNext() {
    const link = $('.cs-next', this.el);
    const bar = $('.cs-next__bar i', this.el);
    let push = 0;
    const onWheel = (e: WheelEvent) => {
      if (this.leaving) return;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (!atEnd || e.deltaY <= 0) {
        push = Math.max(0, push - 0.05);
      } else {
        push = clamp(push + e.deltaY / 1800, 0, 1);
      }
      bar.style.transform = `scaleX(${push})`;
      if (push >= 1) {
        this.leaving = true;
        navigate(`/projects/${this.next.slug}`);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    this.offs.push(() => window.removeEventListener('wheel', onWheel));
    link.addEventListener('pointerenter', () => cursor.setLabel('Next'));
    link.addEventListener('pointerleave', () => cursor.setLabel(null));
    if (state.isTouch) bar.parentElement!.style.display = 'none';
  }

  leave() {
    cursor.setLabel(null);
    return new Promise<void>((resolve) =>
      gsap.to(this.el, { opacity: 0, y: -30, duration: 0.55, ease: 'power2.in', onComplete: resolve }),
    );
  }

  destroy() {
    this.tickers.forEach((t) => gsap.ticker.remove(t));
    this.offs.forEach((f) => f());
    this.lenis?.destroy();
    ScrollTrigger.getAll().forEach((t) => t.kill());
    delete document.documentElement.dataset.scroll;
    $('.header').classList.remove('is-hidden');
    this.el.remove();
  }
}
