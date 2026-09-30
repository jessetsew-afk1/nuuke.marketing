# NUUKE® — marketing site

A WebGL-driven agency site for NUUKE, a social-first marketing studio (paid ads, UGC, content creation,
branding and influencer campaigns). Built with Vite + TypeScript + Three.js + GSAP + Lenis.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # serve the production build
```

Add `?skiploader` to any URL to bypass the Enter screen while developing. In dev only, the browser
console also has `__audit()` / `__auditScroll()` (find overlapping text) and `__go('/path')`.

## Pages

| Route             | What it is |
| ----------------- | ---------- |
| _Loader_          | Dark screen with a tumbling NUUKE letter cube; a blush layer rises as assets load, then googly eyes pop in (they follow the cursor and turn into hearts over **Enter**). |
| `/`               | Index: 3D pink plaster room (arches, sky windows, stairs, reflective water) with the headline “Great products don’t sell themselves”. |
| `/projects`       | Selected Projects: rippling WebGL grid that bends into the distance, arch tunnel, god rays, filters, and butterflies that flutter off the cursor while you hover a project. |
| `/projects/:slug` | Case study (dark): 3D product model, chapters per service with blueprints, creator scripts, ad variants, identity docs, call sheets, creator rosters, auto-playing TikTok reels, a tilted image wall, results and a “keep scrolling” next project. |
| `/world`          | World: infinite draggable field of brand imagery, lens warp on drag, click to focus. |
| `/contact`        | Contact: shares the Index room; the camera turns to the window. |

## Sound

Everything is synthesised in the browser (no audio files): a slow generative piano bed that dips while
visitors scroll or click and swells back when they’re idle, plus hover, click and transition sounds.
See `src/core/audio.ts`.

## Editing content

- **Case studies:** `src/data/projects.ts` (campaign copy, services, results, which 3D model to use).
  Each project’s `categories` decide which chapters/modules its case study shows:
  - `ugc` → storyboard blueprints + creator scripts
  - `paid-ads` → ad variants with test results
  - `branding` → logo construction, colour system, typography docs
  - `content` → call sheet + moodboard
  - `influencer` → creator roster
- **Brand facts, imagery, colours, fonts, logos and TikTok videos:** `src/data/brands.json`, collected
  from each brand’s own website and official social accounts. Videos play through TikTok’s official
  embed player (autoplay, muted); any video TikTok refuses to embed is removed automatically.
- **Filters:** `CATEGORIES` in `src/data/projects.ts`.
- **Logo:** `public/brand/nuuke-logo.png`.
- **Contact details:** `index.html` (menu) and `src/pages/HomePage.ts` (contact page).
- **Contact form:** `src/pages/HomePage.ts`. It currently shows a thank-you message only. Connect it to
  your CRM or form service before launch.

## ⚠️ Before going live

The case studies use real brands’ names, imagery and TikToks, but the **campaigns, scripts, strategy
copy and results are placeholders** written to show the layout. Only publish work you actually did, with
the brands’ permission, and replace the numbers with real results.

Fonts: Inter Tight and Playfair Display (free) stand in for Neue Montreal and Saol Display, which need
commercial licences. Swap them via `--font` / `--serif` in `src/styles/main.css`.

## Structure

```
src/
  core/      state, router, loader, menu, buttons, cursor, audio, dom helpers
  gl/        renderer + scene transitions, fluid sim, butterflies, 3D product models
    scenes/  HomeScene, ProjectsScene, WorldScene, CaseScene
  pages/     HomePage (index + contact), ProjectsPage, CasePage (+ case/modules.ts), WorldPage
  data/      projects.ts (campaign content), brands.json (brand facts & media)
  dev/       audit helpers (dev server only)
  styles/    main.css
```

## Deploying

Any static host works. `vercel.json` and `public/_redirects` (Netlify) rewrite every route to
`index.html` so deep links like `/projects/graza` load correctly.
