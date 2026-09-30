import type { Project } from '../../data/projects';
import { categoryLabel } from '../../data/projects';

/**
 * HTML builders for the case-study "work" modules: storyboard blueprints,
 * creator scripts, ad variants, identity docs, call sheets, creator rosters
 * and the auto-playing reels wall. Content is generated from each brand's
 * data so every case study reads differently.
 */

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Deterministic pseudo-random numbers per brand. */
export const seeded = (seed: string) => {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
};

const pick = <T>(arr: T[], r: () => number) => arr[Math.floor(r() * arr.length)];

const CREATORS = [
  ['Maya Ortiz', '@maya.makes', 'Home cook', '412K'],
  ['Jordan Lee', '@jordaneats', 'Food & lifestyle', '1.1M'],
  ['Priya Shah', '@priyainthekitchen', 'Recipes', '286K'],
  ['Theo Grant', '@theo.outdoors', 'Adventure', '640K'],
  ['Ana Silva', '@ana.grwm', 'Beauty', '902K'],
  ['Kai Brooks', '@kaibrooks', 'Fitness', '755K'],
  ['Noor Haddad', '@noor.at.home', 'Home & interiors', '318K'],
  ['Sam Rivera', '@samtravels', 'Travel', '1.4M'],
  ['Ella Park', '@ellapark.skin', 'Skincare', '534K'],
  ['Marcus Hale', '@marcus.films', 'Photography', '227K'],
  ['Zoe Kim', '@zoe.everyday', 'Lifestyle', '870K'],
  ['Luis Moreno', '@luismoreno', 'Comedy', '2.3M'],
];

// ---------------------------------------------------------------- hero
export const heroHTML = (p: Project) => {
  const primary = p.categories[0];
  const headline: Record<string, [string, string]> = {
    'paid-ads': ['Paid', 'Social'],
    ugc: ['UGC', 'Engine'],
    content: ['Content', 'Studio'],
    branding: ['Brand', 'Identity'],
    influencer: ['Creator', 'Program'],
  };
  const [a, b] = headline[primary];
  return `
    <header class="cs-hero">
      <div class="cs-hero__title">
        <h1><span class="t-serif-i">Projects/</span><span class="t-sans-up">${esc(p.client)}</span></h1>
      </div>
      <div class="cs-hero__kind" aria-hidden="true"><span class="t-sans-up">${a}</span><span class="t-serif-i t-up">${b}</span></div>
      <div class="cs-hero__model js-model-anchor" aria-hidden="true"></div>
      <div class="cs-hero__meta">
        <div class="cs-hero__overview">
          <span class="t-label">Project overview</span>
          <p class="t-lead js-lines">${esc(p.summary)}</p>
        </div>
        <dl class="cs-hero__facts">
          <div><dt class="t-label">Services</dt><dd>${p.services.map(esc).join('<br/>')}</dd></div>
          <div><dt class="t-label">Client</dt><dd>${esc(p.client)}</dd><dt class="t-label">Year</dt><dd>${p.year}</dd></div>
          <div><dt class="t-label">Platforms</dt><dd>${p.platforms.map(esc).join('<br/>')}</dd></div>
        </dl>
        ${p.website ? `<a class="cs-hero__visit" data-btn="fill-light" href="${esc(p.website)}" target="_blank" rel="noopener">Visit ${esc(p.client)}</a>` : ''}
      </div>
    </header>`;
};

// ------------------------------------------------------------ chapter
export const chapterHTML = (num: number, kicker: string, title: [string, string], body: string, inner = '') => `
  <section class="cs-chapter">
    <div class="cs-chapter__head">
      <span class="t-label">Chapter ${String(num).padStart(2, '0')} — ${esc(kicker)}</span>
      <h2 class="cs-chapter__title"><span class="t-serif-i">${esc(title[0])}</span> <span class="t-sans">${esc(title[1])}</span></h2>
      <p class="cs-chapter__body reveal">${esc(body)}</p>
    </div>
    ${inner ? `<div class="cs-chapter__work">${inner}</div>` : ''}
  </section>`;

const docHead = (p: Project, title: string, page: string) => `
  <div class="doc__head"><span>NUUKE × ${esc(p.client.toUpperCase())}</span><span>${esc(title)}</span><span>${page}</span></div>`;

// ----------------------------------------------------------- strategy
export const strategyDocs = (p: Project) => {
  const r = seeded(p.slug + 'strat');
  const pillars = [
    ['Show, don’t claim', `Every asset proves one thing about the ${p.noun} on screen within 3 seconds.`],
    ['Native first', 'Shot vertically, in real homes and hands. No studio gloss unless it earns its place.'],
    ['Hook library', 'Hooks are written, tested and retired like products. Winners are remixed weekly.'],
    ['Creators as channels', 'Creators own the voice. We own the brief, the edit and the distribution.'],
  ];
  const audiences = [
    ['Core', `Existing fans who already love ${p.client} and want to show it off.`],
    ['Curious', `People who have seen ${p.client} around but have not tried a ${p.noun} like this.`],
    ['Switchers', `Loyal to another ${p.noun}; persuaded by side-by-side proof and reviews.`],
  ];
  return `
    <div class="docs docs--pair">
      <article class="doc doc--paper js-doc" style="--r:-3deg">
        ${docHead(p, 'CONTENT PILLARS', '01/02')}
        <h3 class="doc__title">Content pillars</h3>
        <ol class="doc__list">${pillars.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ol>
        <div class="doc__stamp">Approved</div>
      </article>
      <article class="doc doc--paper js-doc" style="--r:2.5deg">
        ${docHead(p, 'AUDIENCE MAP', '02/02')}
        <h3 class="doc__title">Who we talk to</h3>
        <div class="doc__audience">${audiences
          .map(
            ([t, d], i) => `<div><span class="doc__pct">${[46, 34, 20][i] + Math.floor(r() * 4)}%</span><b>${esc(t)}</b><p>${esc(d)}</p></div>`,
          )
          .join('')}</div>
        <div class="doc__note">Platforms: ${p.platforms.map(esc).join(' · ')}</div>
      </article>
    </div>`;
};

// ---------------------------------------------------------- blueprints
const frameArt = (kind: string) => {
  const s = 'stroke="currentColor" fill="none" stroke-width="1.6"';
  const art: Record<string, string> = {
    HOOK: `<rect x="34" y="62" width="32" height="54" rx="6" ${s}/><path d="M18 50l14 12M82 50L68 62M50 36v18" ${s}/><path d="M24 128h52" ${s} stroke-dasharray="3 4"/>`,
    PROBLEM: `<circle cx="50" cy="70" r="16" ${s}/><path d="M28 118c4-16 40-16 44 0" ${s}/><path d="M64 36h22v14H72l-6 6v-6h-2z" ${s}/>`,
    DEMO: `<rect x="40" y="46" width="22" height="42" rx="4" ${s}/><path d="M22 110c6-10 14-18 22-18h12c6 0 8 6 2 8l-10 2" ${s}/><path d="M66 56c8 4 12 12 10 22" ${s} stroke-dasharray="2 3"/>`,
    REACTION: `<circle cx="50" cy="74" r="20" ${s}/><circle cx="43" cy="70" r="2.5" fill="currentColor"/><circle cx="57" cy="70" r="2.5" fill="currentColor"/><path d="M42 82c4 5 12 5 16 0" ${s}/><path d="M22 44l8 8M78 44l-8 8M50 32v10" ${s}/>`,
    PROOF: `<path d="M50 40v96" ${s} stroke-dasharray="3 3"/><rect x="18" y="62" width="26" height="40" ${s}/><rect x="56" y="62" width="26" height="40" ${s}/><path d="M22 96l18-24M60 96l6-8 6 4 8-12" ${s}/>`,
    CTA: `<rect x="24" y="96" width="52" height="16" rx="8" ${s}/><path d="M60 110l6 14 3-6 6-2z" ${s}/><rect x="36" y="48" width="28" height="36" rx="3" ${s}/>`,
  };
  return art[kind];
};

export const blueprints = (p: Project) => {
  const product = p.products[0] ?? p.client;
  const frames: [string, string, string][] = [
    ['HOOK', '0–2s', `Pattern interrupt: ${product} enters frame fast. Text hook on screen.`],
    ['PROBLEM', '2–5s', `Creator to camera: the problem with most ${p.noun}.`],
    ['DEMO', '5–10s', `Macro, natural light: ${product} in use. One continuous take.`],
    ['REACTION', '10–13s', 'Genuine reaction, jump cut. Keep the first take.'],
    ['PROOF', '13–18s', 'Split screen before / after. Numbers on screen.'],
    ['CTA', '18–22s', 'Point to product. “Link in bio” / TikTok Shop tag.'],
  ];
  const card = ([k, t, note]: [string, string, string], i: number) => `
    <div class="bp">
      <div class="bp__top"><span>${String(i + 1).padStart(2, '0')} ${k}</span><span>${t}</span></div>
      <svg class="bp__phone" viewBox="0 0 100 150" aria-hidden="true">
        <rect x="6" y="4" width="88" height="142" rx="12" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M40 10h20" stroke="currentColor" stroke-width="1.4"/>
        ${frameArt(k)}
      </svg>
      <p class="bp__note">${esc(note)}</p>
      <div class="bp__meta"><span>9:16</span><span>${pick(['HANDHELD', 'TRIPOD', 'TOP-DOWN', 'POV'], seeded(p.slug + k))}</span><span>${pick(['NAT. LIGHT', 'WINDOW', 'SOFTBOX'], seeded(k + p.slug))}</span></div>
    </div>`;
  const row = (offset: number) => {
    const cards = frames.map((_, i) => card(frames[(i + offset) % frames.length], (i + offset) % frames.length)).join('');
    return `<div class="bp-row"><div class="bp-track">${cards}${cards}</div></div>`;
  };
  return `
    <div class="bp-stage" aria-label="Storyboard blueprints">
      <div class="bp-plane">
        ${row(0)}${row(3)}${row(1)}
      </div>
    </div>`;
};

// ------------------------------------------------------------- scripts
export const scripts = (p: Project) => {
  const product = p.products[0] ?? p.client;
  const second = p.products[1] ?? product;
  const r = seeded(p.slug + 'scripts');
  const people = [...CREATORS].sort(() => r() - 0.5).slice(0, 3);
  const formats = [
    {
      name: 'Problem → Solution',
      hooks: [
        `“I didn’t think I needed a new ${p.noun}. I was wrong.”`,
        `“Stop scrolling if your ${p.noun} does this…”`,
        `“The ${p.noun} upgrade nobody told me about.”`,
      ],
      body: [
        `Show the everyday frustration (5s). Keep it real, no staging.`,
        `Introduce ${product}. Demo the one thing it does better, in one take.`,
        `Say what surprised you, in your own words.`,
      ],
      cta: `“It’s ${p.client}. Link’s right here.”`,
    },
    {
      name: 'Routine / Day in the life',
      hooks: [
        `“My non-negotiable ${p.noun} step.”`,
        `“Things in my routine that just make sense.”`,
        `“POV: you finally found a ${p.noun} you like.”`,
      ],
      body: [
        `Open mid-routine; ${product} already in hand.`,
        `Voiceover over three quick cuts; show ${second} as the bonus.`,
        `End on the finished moment (the plate, the look, the packed bag).`,
      ],
      cta: `“Mine’s from ${p.client}. Tell me yours in the comments.”`,
    },
    {
      name: 'Honest review',
      hooks: [
        `“I tried ${p.client} for 30 days. Here’s the truth.”`,
        `“Is ${product} actually worth it?”`,
        `“Rating ${p.client} with zero sponsorship energy.”`,
      ],
      body: [
        `Unboxing in 3 cuts max. First impression on camera.`,
        `One pro, one con (keep the con, it builds trust).`,
        `Score out of 10 on screen.`,
      ],
      cta: `“Would I buy it again? Yes. Link below.”`,
    },
  ];
  return `
    <div class="scripts">${formats
      .map(
        (f, i) => `
      <article class="doc doc--script js-doc" style="--r:${[-5, 1.5, 6][i]}deg">
        ${docHead(p, `CREATOR SCRIPT ${String(i + 1).padStart(2, '0')}`, `v${2 + i}`)}
        <div class="script__meta">
          <span>Creator: <b>${people[i][1]}</b></span><span>Format: ${f.name}</span><span>Length: ${18 + i * 4}s</span>
        </div>
        <h4>Hook options</h4>
        <ol class="script__hooks">${f.hooks.map((h, k) => `<li${k === 0 ? ' class="is-pick"' : ''}>${esc(h)}</li>`).join('')}</ol>
        <span class="script__scribble">↑ use this hook</span>
        <h4>Body</h4>
        <ul class="script__body">${f.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
        <h4>CTA</h4>
        <p class="script__cta">${esc(f.cta)}</p>
      </article>`,
      )
      .join('')}
    </div>`;
};

// ---------------------------------------------------------------- reels
export const reels = (p: Project) => {
  const vids = p.videos.slice(0, 6);
  const frames = vids.length
    ? vids
        .map(
          (v, i) => `
        <figure class="reel js-reel" data-video="${esc(v.id)}">
          <div class="reel__screen"><div class="reel__poster" style="background-image:url('${esc(p.images[i % p.images.length].url)}')"></div></div>
          <figcaption><b>@${esc(v.author)}</b><span>${esc(v.title || p.client)}</span></figcaption>
        </figure>`,
        )
        .join('')
    : p.images
        .slice(0, 5)
        .map(
          (im) => `
        <figure class="reel">
          <div class="reel__screen"><img src="${esc(im.url)}" alt="${esc(im.alt)}" loading="lazy" /></div>
          <figcaption><b>@${esc(p.slug)}</b><span>${esc(p.title)}</span></figcaption>
        </figure>`,
        )
        .join('');
  return `
    <section class="cs-reels">
      <div class="cs-reels__head">
        <h2><span class="t-sans">Creator content</span><br/><span class="t-serif-i">made for the feed</span></h2>
        <p class="t-label">Auto-playing · muted · from ${esc(p.client)}’s TikTok</p>
      </div>
      <div class="cs-reels__track" data-hover>${frames}</div>
    </section>`;
};

// ---------------------------------------------------------- ad variants
export const adVariants = (p: Project) => {
  const r = seeded(p.slug + 'ads');
  const product = p.products[0] ?? p.client;
  const copies = [
    [`The ${p.noun} everyone’s switching to.`, 'Shop now'],
    [`${product}: see why it sells out.`, 'Learn more'],
    [`Rated by real people. Loved by ${p.client} fans.`, 'Shop now'],
    [`Your new favourite ${p.noun}. Try it risk-free.`, 'Get offer'],
  ];
  const winner = Math.floor(r() * 4);
  return `
    <div class="ads">${copies
      .map(([copy, cta], i) => {
        const ctr = (1.2 + r() * 2.6).toFixed(2);
        const cpa = (8 + r() * 22).toFixed(2);
        return `
        <article class="ad js-doc ${i === winner ? 'is-winner' : ''}" style="--r:${[-4, -1.5, 1.5, 4][i]}deg">
          <div class="ad__bar"><i></i><b>${esc(p.client.toLowerCase().replace(/\s+/g, ''))}</b><span>Sponsored</span></div>
          <div class="ad__media"><img src="${esc(p.images[(i + 1) % p.images.length].url)}" alt="" loading="lazy" /><span class="ad__tag">Variant ${String.fromCharCode(65 + i)}</span></div>
          <p class="ad__copy">${esc(copy)}</p>
          <div class="ad__cta"><span>${esc(product)}</span><button type="button" tabindex="-1">${cta}</button></div>
          <div class="ad__stats"><span>CTR ${ctr}%</span><span>CPA $${cpa}</span>${i === winner ? '<em>Winner</em>' : ''}</div>
        </article>`;
      })
      .join('')}
    </div>`;
};

// ------------------------------------------------------------- identity
const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToCmyk = ([r, g, b]: number[]) => {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return [0, 0, 0, 100];
  const c = (1 - r / 255 - k) / (1 - k);
  const m = (1 - g / 255 - k) / (1 - k);
  const y = (1 - b / 255 - k) / (1 - k);
  return [c, m, y, k].map((v) => Math.round(v * 100));
};

export const identityDocs = (p: Project) => {
  const font = p.fonts[0] ?? 'Custom grotesk';
  const mark = p.logo
    ? `<img class="logo-doc__img" src="${esc(p.logo)}" alt="${esc(p.client)} logo" />`
    : `<span class="logo-doc__word">${esc(p.client)}</span>`;
  return `
    <div class="docs docs--identity">
      <article class="doc doc--dark logo-doc js-doc" style="--r:-2deg">
        ${docHead(p, 'LOGO CONSTRUCTION', '01/03')}
        <div class="logo-doc__stage">
          <div class="logo-doc__grid" aria-hidden="true">
            <i class="lg-h" style="top:27%"></i><i class="lg-h" style="top:50%"></i><i class="lg-h" style="top:73%"></i>
            <i class="lg-v" style="left:10%"></i><i class="lg-v" style="left:90%"></i>
            <i class="lg-c" style="left:30%;width:35%"></i><i class="lg-c" style="left:70%;width:35%"></i><i class="lg-c" style="left:50%;width:25%"></i>
            <i class="lg-dim"></i>
          </div>
          <div class="logo-doc__mark">${mark}</div>
          <span class="logo-doc__x">x</span><span class="logo-doc__x logo-doc__x--r">x</span>
        </div>
        <div class="doc__row"><span>Clear space: 1x</span><span>Min. size: 24px</span><span>Grid: 8pt</span></div>
      </article>
      <article class="doc doc--paper palette-doc js-doc" style="--r:2deg">
        ${docHead(p, 'COLOUR SYSTEM', '02/03')}
        <div class="palette">${p.colors
          .slice(0, 5)
          .map((c) => {
            const rgb = hexToRgb(c.hex);
            const cmyk = rgbToCmyk(rgb);
            return `<div class="swatch"><i style="background:${esc(c.hex)}"></i><b>${esc(c.name)}</b><span>HEX ${esc(c.hex.toUpperCase())}</span><span>RGB ${rgb.join(' ')}</span><span>CMYK ${cmyk.join(' ')}</span></div>`;
          })
          .join('')}</div>
      </article>
      <article class="doc doc--paper type-doc js-doc" style="--r:-1deg">
        ${docHead(p, 'TYPOGRAPHY', '03/03')}
        <div class="type-doc__aa">Aa</div>
        <div class="type-doc__name">${esc(font)}</div>
        <p class="type-doc__abc">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br/>abcdefghijklmnopqrstuvwxyz<br/>0123456789 &amp; @ # ! ?</p>
        <div class="doc__row"><span>H1 64/60</span><span>Body 16/24</span><span>Caption 11/14</span></div>
      </article>
    </div>`;
};

// ---------------------------------------------------------- production
export const productionDocs = (p: Project) => {
  const product = p.products[0] ?? p.client;
  const shots = [
    ['08:30', `Hero: ${product} on set, top-down`, 'Studio A'],
    ['09:15', `Hands-in: ${p.noun} in use, macro`, 'Studio A'],
    ['10:30', 'Creator routine, natural light', 'Location — apartment'],
    ['12:00', 'Lunch', '—'],
    ['13:00', `Lifestyle: ${p.products[1] ?? product} in context`, 'Location — outdoor'],
    ['15:00', 'Talking heads × 3, testimonials', 'Studio B'],
    ['16:30', 'Pick-ups, B-roll, stills', 'Studio B'],
  ];
  return `
    <div class="docs docs--production">
      <article class="doc doc--paper callsheet js-doc" style="--r:-2deg">
        ${docHead(p, 'CALL SHEET — DAY 1', '01/01')}
        <table><thead><tr><th>Time</th><th>Shot</th><th>Location</th></tr></thead><tbody>
          ${shots.map(([t, s, l]) => `<tr><td>${t}</td><td>${esc(s)}</td><td>${esc(l)}</td></tr>`).join('')}
        </tbody></table>
        <div class="doc__row"><span>Deliverables: 24 × 9:16, 8 × 4:5, 40 stills</span></div>
      </article>
      <div class="moodboard">${p.images
        .slice(0, 6)
        .map((im, i) => `<figure class="js-doc" style="--r:${[-6, 4, -2, 5, -4, 2][i]}deg"><img src="${esc(im.url)}" alt="${esc(im.alt)}" loading="lazy" /></figure>`)
        .join('')}</div>
    </div>`;
};

// ------------------------------------------------------------- creators
export const creatorRoster = (p: Project) => {
  const r = seeded(p.slug + 'roster');
  const people = [...CREATORS].sort(() => r() - 0.5).slice(0, 6);
  return `
    <div class="roster">${people
      .map(
        ([name, handle, niche, followers], i) => `
      <article class="creator js-doc" style="--r:${(r() * 6 - 3).toFixed(1)}deg">
        <i class="creator__avatar" style="--h:${Math.floor(r() * 360)}">${name
          .split(' ')
          .map((w) => w[0])
          .join('')}</i>
        <b>${esc(name)}</b><span>${esc(handle)}</span>
        <div class="creator__row"><span>${esc(niche)}</span><span>${followers}</span></div>
        <em>${['Contracted', 'Live', 'Whitelisted', 'Contracted', 'Live', 'Seeded'][i]}</em>
      </article>`,
      )
      .join('')}
    </div>`;
};

// ------------------------------------------------------------- results
export const resultsHTML = (p: Project) => `
  <section class="cs-results">
    <h2><span class="t-serif-i">The</span> <span class="t-sans-up">Results</span></h2>
    <div class="cs-results__grid">${p.kpis
      .map(
        (k, i) => `
      <div class="cs-kpi reveal"><span class="t-label">(0${i + 1})</span><div class="cs-kpi__value" data-kpi="${i}">0</div><div class="cs-kpi__label">${esc(k.label)}</div></div>`,
      )
      .join('')}</div>
    <p class="t-label cs-results__note">Services: ${p.categories.map(categoryLabel).join(' · ')}</p>
  </section>`;

// -------------------------------------------------------------- mosaic
export const mosaicHTML = (p: Project) => {
  const imgs = [...p.images, ...p.images, ...p.images].slice(0, 12);
  return `
    <section class="cs-mosaic" aria-label="${esc(p.client)} imagery">
      <div class="cs-mosaic__plane">${imgs
        .map((im) => `<figure><img src="${esc(im.url)}" alt="${esc(im.alt)}" loading="lazy" /></figure>`)
        .join('')}</div>
    </section>`;
};

// ---------------------------------------------------------------- next
export const nextHTML = (next: Project) => `
  <a class="cs-next" href="/projects/${next.slug}" data-link>
    <div class="cs-next__model js-next-anchor" aria-hidden="true"></div>
    <div class="cs-next__text">
      <span class="t-serif-i t-up">Next</span>
      <span class="t-sans-up cs-next__name">${esc(next.client)}</span>
      <span class="t-label">(Keep scrolling)</span>
    </div>
    <div class="cs-next__bar"><i></i></div>
  </a>`;
