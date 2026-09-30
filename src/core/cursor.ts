import { $ } from './dom';
import { audio } from './audio';
import { damp, state } from './state';

/**
 * Custom cursor: a dot that trails the pointer, shrinks over links, grows
 * into a labelled disc ("View", "Drag", …) and shows a hold ring.
 */
class Cursor {
  el = $('.cursor');
  dot = $('.cursor__dot', this.el);
  label = $('.cursor__label', this.el);
  ring = $<SVGCircleElement>('.cursor__ring circle', this.el);
  x = state.w / 2;
  y = state.h / 2;
  private currentLabel: string | null = null;
  private hovered: Element | null = null;

  init() {
    if (state.isTouch) return;
    document.documentElement.classList.add('has-cursor');
    document.addEventListener('pointerover', (e) => {
      const t = (e.target as Element).closest('a, button, [data-hover]');
      if (t && t !== this.hovered) {
        this.hovered = t;
        this.el.classList.add('is-link');
        audio.hover();
      } else if (!t) {
        this.hovered = null;
        this.el.classList.remove('is-link');
      }
    });
    document.addEventListener('pointerdown', () => this.el.classList.add('is-down'));
    document.addEventListener('pointerup', () => this.el.classList.remove('is-down'));
    document.addEventListener('pointerleave', () => this.el.classList.add('is-hidden'));
    document.addEventListener('pointerenter', () => this.el.classList.remove('is-hidden'));
  }

  setLabel(text: string | null) {
    if (text === this.currentLabel) return;
    this.currentLabel = text;
    if (text) {
      this.label.textContent = text;
      this.el.classList.add('has-label');
    } else {
      this.el.classList.remove('has-label');
    }
  }

  /** 0..1 fills the ring. Pass null to hide it. */
  setHold(p: number | null) {
    if (p === null) {
      this.el.classList.remove('is-holding');
      this.ring.style.strokeDashoffset = '289';
      return;
    }
    this.el.classList.add('is-holding');
    this.ring.style.strokeDashoffset = String(289 * (1 - p));
  }

  update(dt: number) {
    if (state.isTouch) return;
    this.x = damp(this.x, state.mouse.x, 22, dt);
    this.y = damp(this.y, state.mouse.y, 22, dt);
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
  }
}

export const cursor = new Cursor();
