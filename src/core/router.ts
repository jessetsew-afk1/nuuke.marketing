import { $, initRolls } from './dom';
import { initButtons } from './buttons';
import { audio } from './audio';
import { menu } from './menu';
import { setNavigate } from './nav';
import { state } from './state';
import { gl } from '../gl/gl';
import type { Page } from '../pages/types';
import { ProjectsPage } from '../pages/ProjectsPage';
import { HomePage } from '../pages/HomePage';
import { CasePage } from '../pages/CasePage';
import { WorldPage } from '../pages/WorldPage';
import { getProject } from '../data/projects';

type Route = { re: RegExp; make: (m: RegExpMatchArray) => Page | null };

const routes: Route[] = [
  { re: /^\/$/, make: () => new HomePage('home') },
  { re: /^\/contact\/?$/, make: () => new HomePage('contact') },
  { re: /^\/projects\/?$/, make: () => new ProjectsPage() },
  { re: /^\/projects\/([\w-]+)\/?$/, make: (m) => (getProject(m[1]) ? new CasePage(m[1]) : null) },
  { re: /^\/world\/?$/, make: () => new WorldPage() },
];

const resolve = (path: string): { page: Page; path: string } => {
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      const page = r.make(m);
      if (page) return { page, path };
    }
  }
  return { page: new HomePage('home'), path: '/' };
};

class Router {
  current: Page | null = null;
  private busy = false;
  private queued: string | null = null;
  private app = $('#app');

  init() {
    setNavigate((p) => this.go(p));
    document.addEventListener('click', (e) => {
      const a = (e.target as Element).closest('a') as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || a.hasAttribute('download')) return;
      if (a.getAttribute('href') === '#') {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      audio.click();
      this.go(url.pathname);
    });
    window.addEventListener('popstate', () => this.go(location.pathname, false));
    this.syncNav();
  }

  /** Mounts the first page without a transition (the loader covers it). */
  mountFirst() {
    const { page, path } = resolve(location.pathname);
    if (path !== location.pathname) history.replaceState({}, '', path);
    this.mount(page);
    gl.show(page.scene, 0);
    return page;
  }

  private mount(page: Page) {
    this.current = page;
    state.route = location.pathname;
    document.body.dataset.theme = page.theme;
    document.title = page.title === 'Index' ? 'NUUKE® – Social-first marketing studio' : `NUUKE® – ${page.title}`;
    this.app.appendChild(page.el);
    initRolls(page.el);
    initButtons(page.el);
    audio.mood(page.mood);
    this.syncNav();
  }

  async go(path: string, push = true) {
    if (this.busy) {
      this.queued = path;
      return;
    }
    if (path === location.pathname && this.current) {
      if (state.menuOpen) menu.close();
      return;
    }
    this.busy = true;
    const closing = state.menuOpen ? menu.close(true) : Promise.resolve();
    const { page: next, path: finalPath } = resolve(path);
    if (push) history.pushState({}, '', finalPath);
    audio.whoosh();

    const prev = this.current;
    if (prev) await Promise.all([prev.leave(), closing]);
    prev?.destroy();
    window.scrollTo(0, 0);
    this.mount(next);
    gl.show(next.scene);
    next.enter({ first: false });

    this.busy = false;
    if (this.queued) {
      const q = this.queued;
      this.queued = null;
      if (q !== location.pathname) this.go(q);
    }
  }

  private syncNav() {
    document.querySelectorAll<HTMLAnchorElement>('.header__nav a, .menu__list a').forEach((a) => {
      const href = a.getAttribute('href')!;
      const active = href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);
      a.classList.toggle('is-current', active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
}

export const router = new Router();
