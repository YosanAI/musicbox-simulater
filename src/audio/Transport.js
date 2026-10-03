import { clamp, modulo } from '../math/scalars.js';

/** All scheduling constants retain the timing of the original demo. */
export const TRANSPORT_TIMING = Object.freeze({
  schedulerIntervalMs: 25,
  lookAheadSeconds: 0.12,
  startLeadSeconds: 0.055,
  lateToleranceSeconds: 0.04,
  maxEventsPerSchedule: 1200,
  springRevolutions: 5,
});

/**
 * Audio-clock transport. requestAnimationFrame only observes this clock;
 * it does not determine when a note starts. A generation token cancels
 * an in-flight play() when pause(), seek() or a cylinder swap intervenes.
 */
export class Transport {
  constructor(sound, onStrike, onEnd) {
    this.sound = sound;
    this.onStrike = onStrike;
    this.onEnd = onEnd;
    this.spec = null;
    this.running = false;
    this.offset = 0;
    this.speed = 1;
    this.loop = false;
    this.queue = [];
    this.index = 0;
    this.cycle = 0;
    this.timer = null;
    this.virtualReserve = 1;
    this.generation = 0;
    this.lastAudioTime = 0;
  }

  setSpec(spec) {
    this.pause();
    this.spec = spec;
    this.offset = 0;
    this.virtualReserve = 1;
    this.queue = [];
  }

  absoluteTime(audioTime = this.sound.context?.currentTime) {
    if (!this.running) return this.offset;
    return Math.max(this.offset, this.offset + (audioTime - this.startAudioTime) * this.speed);
  }

  position() {
    if (!this.spec) return 0;
    const elapsed = this.absoluteTime();
    return this.loop ? modulo(elapsed, this.spec.duration) : Math.min(elapsed, this.spec.duration);
  }

  async play() {
    if (this.running || !this.spec) return;
    const generation = ++this.generation;
    const context = await this.sound.init();
    if (generation !== this.generation) return;

    this.sound.prepareNotes(this.spec.notes);
    if (!this.loop && this.offset >= this.spec.duration - 0.001) this.offset = 0;

    this.running = true;
    this.startAudioTime = context.currentTime + TRANSPORT_TIMING.startLeadSeconds;
    this.lastAudioTime = this.startAudioTime;
    this.queue = [];
    this.reindex();
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TRANSPORT_TIMING.schedulerIntervalMs);
  }

  /** Find the next pin, including the appropriate revolution when repeating. */
  reindex() {
    const duration = this.spec.duration;
    this.cycle = Math.floor(this.offset / duration);
    const phase = modulo(this.offset, duration);
    this.index = this.spec.notes.findIndex(note => note.time >= phase - 1e-6);
    if (this.index < 0) {
      this.cycle++;
      this.index = 0;
    }
  }

  schedule() {
    if (!this.running) return;
    const now = this.sound.context.currentTime;
    const horizon = this.absoluteTime(now + TRANSPORT_TIMING.lookAheadSeconds);
    const { notes, duration } = this.spec;
    if (!notes.length) return;

    for (let scheduled = 0; scheduled < TRANSPORT_TIMING.maxEventsPerSchedule; scheduled++) {
      if (!this.loop && this.cycle > 0) break;
      const note = notes[this.index];
      const time = note.time + this.cycle * duration;
      if (time > horizon) break;

      const when = this.startAudioTime + (time - this.offset) / this.speed;
      if (when >= now - TRANSPORT_TIMING.lateToleranceSeconds) {
        const start = Math.max(now, when);
        this.sound.strike(note, start);
        this.queue.push({ event: note, when: start });
      }
      this.index++;
      if (this.index >= notes.length) {
        this.index = 0;
        this.cycle++;
      }
    }
  }

  /** Release visual strikes when their corresponding audio events become due. */
  update() {
    if (!this.running) return;
    const now = this.sound.context.currentTime;
    while (this.queue.length && this.queue[0].when <= now) {
      const strike = this.queue.shift();
      this.onStrike(strike.event, now - strike.when);
    }

    const depletion = Math.max(0, now - this.lastAudioTime) * this.speed /
      (this.spec.duration * TRANSPORT_TIMING.springRevolutions);
    this.virtualReserve = Math.max(0, this.virtualReserve - depletion);
    this.lastAudioTime = now;

    const reachedEnd = !this.loop && this.absoluteTime() >= this.spec.duration;
    if (reachedEnd || this.virtualReserve <= 0) {
      this.offset = this.virtualReserve <= 0 ? this.position() : this.spec.duration;
      this.running = false;
      clearInterval(this.timer);
      this.timer = null;
      this.queue = [];
      this.onEnd?.(this.virtualReserve <= 0 ? 'spring' : 'end');
    }
  }

  pause() {
    this.generation++;
    if (this.running) this.offset = this.position();
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
    this.sound.silence();
  }

  async seek(time) {
    const wasPlaying = this.running;
    this.pause();
    this.offset = clamp(time, 0, this.spec.duration);
    if (wasPlaying) await this.play();
  }

  async setSpeed(speed) {
    const wasPlaying = this.running;
    this.pause();
    this.speed = speed;
    if (wasPlaying) await this.play();
  }

  reset() {
    this.pause();
    this.offset = 0;
  }

  dispose() {
    this.pause();
    this.onStrike = () => {};
    this.onEnd = null;
  }
}
