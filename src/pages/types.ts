import type { Scene3D } from '../gl/gl';

export interface Page {
  el: HTMLElement;
  /** WebGL scene shown behind this page. */
  scene: Scene3D;
  theme: 'light' | 'dark';
  mood: 'light' | 'dark' | 'bright';
  /** Document title suffix. */
  title: string;
  enter(opts: { first: boolean }): void;
  leave(): Promise<void>;
  destroy(): void;
}
