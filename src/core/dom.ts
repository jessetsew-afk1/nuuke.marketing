export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

export const html = (str: string) => {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild as HTMLElement;
};

/**
 * Hover "text roll": every character slides up and is replaced by a copy of
 * itself from below, staggered left-to-right.
 */
export const initRolls = (root: ParentNode = document) => {
  $$('[data-roll]', root).forEach((el) => {
    if (el.dataset.rollReady) return;
    el.dataset.rollReady = '1';
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text.trim());
    el.textContent = '';
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'roll__char';
      s.textContent = c;
      s.dataset.c = c;
      s.style.setProperty('--i', String(i));
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
    });
  });
};

/** Wraps each character in a span for GSAP. Returns the char spans. */
export const splitChars = (el: HTMLElement) => {
  const text = el.textContent ?? '';
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const out: HTMLElement[] = [];
  text.split(' ').forEach((word, wi, arr) => {
    const w = document.createElement('span');
    w.style.display = 'inline-block';
    w.style.whiteSpace = 'nowrap';
    w.setAttribute('aria-hidden', 'true');
    [...word].forEach((c) => {
      const s = document.createElement('span');
      s.className = 'split-char';
      s.textContent = c;
      w.appendChild(s);
      out.push(s);
    });
    el.appendChild(w);
    if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return out;
};

/** Splits text into visual lines, each wrapped in a mask for a slide-up reveal. */
export const splitLines = (el: HTMLElement) => {
  const text = el.textContent ?? '';
  const words = text.split(/\s+/).filter(Boolean);
  el.setAttribute('aria-label', text);
  el.innerHTML = words.map((w) => `<span class="w" style="display:inline-block">${w}</span>`).join(' ');
  const wEls = $$('.w', el);
  const lines: string[][] = [];
  let top = -1;
  wEls.forEach((w) => {
    const t = w.offsetTop;
    if (Math.abs(t - top) > 2) {
      lines.push([]);
      top = t;
    }
    lines[lines.length - 1].push(w.textContent ?? '');
  });
  el.innerHTML = lines
    .map((l) => `<span class="split-line" aria-hidden="true"><span>${l.join(' ')}</span></span>`)
    .join('');
  return $$('.split-line > span', el);
};

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
