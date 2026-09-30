/**
 * Dev-only helpers (loaded only by `npm run dev`):
 *   __audit()  -> list of visible text runs that overlap each other
 *   __go(path) -> in-app navigation without a reload
 */
import { navigate } from '../core/nav';

const isFixedUi = (el: Element) => {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    if (getComputedStyle(e).position === 'fixed' && !e.matches('.page-fixed, .home, .contact, .projects, .world'))
      return true;
  }
  return false;
};

const isVisible = (el: Element) => {
  for (let e: Element | null = el; e && e !== document.documentElement; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) return false;
  }
  return true;
};

/** Clip a rect by every overflow-hidden ancestor; null if fully clipped. */
const clipRect = (el: Element, rect: DOMRect) => {
  let { left, top, right, bottom } = rect;
  for (let e: Element | null = el.parentElement; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
    const c = e.getBoundingClientRect();
    left = Math.max(left, c.left);
    top = Math.max(top, c.top);
    right = Math.min(right, c.right);
    bottom = Math.min(bottom, c.bottom);
    if (right - left < 2 || bottom - top < 2) return null;
  }
  return new DOMRect(left, top, right - left, bottom - top);
};

export const audit = () => {
  // measure the resting layout: no tilts, no marquees
  const freeze = document.createElement('style');
  freeze.textContent = '.js-doc,.bp-plane,.bp-track,.cs-mosaic__plane{transform:none!important;animation:none!important}';
  document.head.appendChild(freeze);
  try {
    return measure();
  } finally {
    freeze.remove();
  }
};

const measure = () => {
  const runs: { el: Element; text: string; rect: DOMRect; fixed: boolean }[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n.nodeValue?.trim();
    const el = n.parentElement;
    if (!text || !el || el.closest('script,style,svg,.cursor,.loader,.menu:not(.is-active)') || !isVisible(el)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const raw of r.getClientRects()) {
      const rect = clipRect(el, raw);
      if (!rect || rect.width < 2 || rect.height < 2) continue;
      if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      runs.push({ el, text: text.slice(0, 40), rect, fixed: isFixedUi(el) });
    }
  }
  const hits: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i];
      const b = runs[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el) || a.fixed !== b.fixed) continue;
      const same = (s: string) => a.el.closest(s) && a.el.closest(s) === b.el.closest(s);
      if (same('[data-roll]') || same('.btn') || same('.menu__label') || same('.split-line')) continue;
      if (a.el.closest('.split-char') && b.el.closest('.split-char') && a.el.parentElement === b.el.parentElement) continue;
      const ox = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const oy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      const minH = Math.min(a.rect.height, b.rect.height);
      if (ox > 3 && oy > Math.max(3, minH * 0.28))
        hits.push(`"${a.text}" <> "${b.text}" (${Math.round(ox)}x${Math.round(oy)} @${Math.round(a.rect.left)},${Math.round(a.rect.top)})`);
    }
  }
  return [...new Set(hits)];
};

/** Scrolls through the whole document and audits each screen. */
export const auditScroll = async (step = 0.8) => {
  const out: string[] = [];
  const max = document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y <= max + 1; y += innerHeight * step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 450));
    audit().forEach((h) => out.push(`[y=${Math.round(y)}] ${h}`));
  }
  return [...new Set(out)];
};

Object.assign(window as any, { __audit: audit, __auditScroll: auditScroll, __go: (p: string) => navigate(p) });
