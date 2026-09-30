import { $ } from './dom';
import { state } from './state';

/**
 * Sound design, synthesised live with Web Audio (no audio files):
 *  - a generative, slow "zen" piano bed (pentatonic phrases and soft chords
 *    through a long reverb) that swells while the visitor is idle and dips
 *    politely while they scroll, drag or click;
 *  - small UI sounds: hover, click and page-transition whoosh.
 */

// D major pentatonic, spread over a few octaves (Hz)
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const SCALE = [62, 64, 66, 69, 71]; // D E F# A B
const CHORDS = [
  [50, 57, 62, 66], // D  add9-ish
  [47, 54, 59, 62], // Bm7
  [43, 50, 55, 59], // G
  [45, 52, 57, 61], // A
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  music!: GainNode;
  sfx!: GainNode;
  private reverb!: ConvolverNode;
  private noiseBuf!: AudioBuffer;
  private btn = $('.sound-toggle');
  private lastHover = 0;
  private timer = 0;
  private chordIndex = 0;
  private melodyIndex = 2;
  private nextChordAt = 0;
  private idleTimer = 0;
  private octaveShift = 0;
  private tempo = 1;

  init() {
    this.btn.addEventListener('click', () => this.toggle());
    const activity = () => this.onActivity();
    window.addEventListener('wheel', activity, { passive: true });
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    window.addEventListener('touchmove', activity, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend();
      else if (state.soundOn) this.ctx.resume();
    });
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 1;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.9;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 3200;
    this.music.connect(tone);

    // long, soft reverb from a generated impulse response
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 4.5;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    tone.connect(this.reverb).connect(wet).connect(this.master);
    tone.connect(dry).connect(this.master);

    // noise for UI sounds
    const nlen = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < nlen; i++) {
      b0 = 0.97 * b0 + (Math.random() * 2 - 1) * 0.03;
      nd[i] = b0 * 3.2;
    }
  }

  /** A soft piano-ish voice: a few decaying partials plus a faint hammer. */
  private note(n: number, when: number, vel = 0.5, dur = 5) {
    const ctx = this.ctx!;
    const f = midi(n);
    const out = ctx.createGain();
    out.gain.value = vel * 0.16;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.6, Math.min(0.6, (n - 62) / 30));
    out.connect(pan).connect(this.music);

    const partials: [number, number, number][] = [
      // ratio, gain, decay multiplier
      [1, 1, 1],
      [2.001, 0.42, 0.55],
      [3.003, 0.16, 0.35],
      [4.01, 0.07, 0.25],
    ];
    partials.forEach(([r, g, d]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * r;
      o.detune.value = (Math.random() - 0.5) * 4;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(g, when + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur * d);
      o.connect(env).connect(out);
      o.start(when);
      o.stop(when + dur * d + 0.05);
    });
    // hammer
    const h = ctx.createBufferSource();
    h.buffer = this.noiseBuf;
    const hf = ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = f * 4;
    hf.Q.value = 1.5;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.05 * vel, when);
    hg.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    h.connect(hf).connect(hg).connect(out);
    h.start(when, Math.random());
    h.stop(when + 0.06);
  }

  /** Schedules the next musical event; keeps itself going with a timer. */
  private loop = () => {
    if (!this.ctx || !state.soundOn) return;
    const now = this.ctx.currentTime;
    const t = now + 0.05;
    if (now >= this.nextChordAt) {
      const chord = CHORDS[this.chordIndex % CHORDS.length];
      chord.forEach((n, i) => this.note(n + this.octaveShift, t + i * 0.06, 0.32 - i * 0.03, 7));
      this.chordIndex++;
      this.nextChordAt = now + 9.5 * this.tempo;
    }
    // gentle melodic random walk
    if (Math.random() < 0.82) {
      this.melodyIndex = Math.max(0, Math.min(9, this.melodyIndex + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
      const n = SCALE[this.melodyIndex % 5] + 12 * Math.floor(this.melodyIndex / 5) + this.octaveShift;
      this.note(n, t, 0.28 + Math.random() * 0.18, 4.5);
      if (Math.random() < 0.18) this.note(n + 12, t + 0.28, 0.16, 3.5);
    }
    const gap = (1.4 + Math.random() * 1.8) * this.tempo;
    this.timer = window.setTimeout(this.loop, gap * 1000);
  };

  private onActivity() {
    if (!this.ctx || !state.soundOn) return;
    const t = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setTargetAtTime(0.4, t, 0.25);
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (!this.ctx) return;
      this.music.gain.setTargetAtTime(0.9, this.ctx.currentTime, 1.6);
    }, 1400);
  }

  async enable() {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    state.soundOn = true;
    const t = this.ctx!.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.9, t, 0.8);
    this.btn.classList.add('is-on');
    this.btn.setAttribute('aria-pressed', 'true');
    window.clearTimeout(this.timer);
    this.nextChordAt = 0;
    this.loop();
  }

  disable() {
    state.soundOn = false;
    window.clearTimeout(this.timer);
    this.btn.classList.remove('is-on');
    this.btn.setAttribute('aria-pressed', 'false');
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
  }

  toggle() {
    state.soundOn ? this.disable() : this.enable();
  }

  /** Page moods: shift register and pace. */
  mood(name: 'light' | 'dark' | 'bright') {
    this.octaveShift = name === 'dark' ? -12 : 0;
    this.tempo = name === 'dark' ? 1.35 : name === 'bright' ? 0.9 : 1;
  }

  private blip(freq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
    if (!state.soundOn || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.62, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hover() {
    const now = performance.now();
    if (now - this.lastHover < 60) return;
    this.lastHover = now;
    this.blip(1500 + Math.random() * 200, 0.07, 0.035);
  }

  click() {
    this.blip(620, 0.12, 0.08, 'triangle');
  }

  whoosh(dur = 1.2) {
    if (!state.soundOn || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
}

export const audio = new AudioEngine();
