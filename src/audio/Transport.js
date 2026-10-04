import { clamp, modulo } from '../math/scalars.js';
import { getCylinderDuration, getNoteTime } from '../cylinder/timing.js';

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
  constructor(sound, onStrike, onEnd, onIndex = null) {
    this.sound = sound;
    this.onStrike = onStrike;
    this.onEnd = onEnd;
    this.onIndex = onIndex;
    this.spec = null;
    this.running = false;
    this.offset = 0;
    this.speed = 1;
    this.loop = false;
    this.queue = [];
    this.shiftQueue = [];
    this.index = 0;
    this.cycle = 0;
    this.nextShift = 1;
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
    this.shiftQueue = [];
  }

  absoluteTime(audioTime = this.sound.context?.currentTime) {
    if (!this.running) return this.offset;
    return Math.max(this.offset, this.offset + (audioTime - this.startAudioTime) * this.speed);
  }

  position() {
    if (!this.spec) return 0;
    const elapsed = this.absoluteTime();
    const duration = getCylinderDuration(this.spec);
    return this.loop ? modulo(elapsed, duration) : Math.min(elapsed, duration);
  }

  async play() {
    if (this.running || !this.spec) return;
    const generation = ++this.generation;
    const context = await this.sound.init();
    if (generation !== this.generation) return;

    this.sound.prepareNotes(this.spec.notes);
    if (!this.loop && this.offset >= getCylinderDuration(this.spec) - 0.001) this.offset = 0;

    this.running = true;
    this.startAudioTime = context.currentTime + TRANSPORT_TIMING.startLeadSeconds;
    this.lastAudioTime = this.startAudioTime;
    this.queue = [];
    this.shiftQueue = [];
    this.reindex();
    this.schedule();
    this.timer = setInterval(() => this.schedule(), TRANSPORT_TIMING.schedulerIntervalMs);
  }

  /** Find the next pin and automatic shift in the entire indexed programme. */
  reindex() {
    const duration = getCylinderDuration(this.spec);
    this.cycle = Math.floor(this.offset / duration);
    const phase = modulo(this.offset, duration);
    this.index = this.spec.notes.findIndex(note => getNoteTime(note, this.spec) >= phase - 1e-6);
    if (this.index < 0) {
      this.cycle++;
      this.index = 0;
    }
    // Seeking directly onto a boundary selects its track without playing a knock.
    this.nextShift = Math.floor((this.offset + 1e-6) / this.spec.duration) + 1;
  }

  schedule() {
    if (!this.running) return;
    const now = this.sound.context.currentTime;
    const horizon = this.absoluteTime(now + TRANSPORT_TIMING.lookAheadSeconds);
    const { notes } = this.spec;
    const duration = getCylinderDuration(this.spec);

    for (let scheduled = 0; notes.length && scheduled < TRANSPORT_TIMING.maxEventsPerSchedule; scheduled++) {
      if (!this.loop && this.cycle > 0) break;
      const note = notes[this.index];
      const time = getNoteTime(note, this.spec) + this.cycle * duration;
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
    if ((this.spec.turns ?? 1) > 1) {
      for (let scheduled = 0; scheduled < TRANSPORT_TIMING.maxEventsPerSchedule; scheduled++) {
        const time = this.nextShift * this.spec.duration;
        if (time > horizon || (!this.loop && time >= duration)) break;
        const when = this.startAudioTime + (time - this.offset) / this.speed;
        if (when >= now - TRANSPORT_TIMING.lateToleranceSeconds) {
          const start = Math.max(now, when);
          this.sound.indexKnock?.(start);
          this.shiftQueue.push({ turn: this.nextShift % this.spec.turns, when: start });
        }
        this.nextShift++;
      }
    }
  }

  /** Release visual strikes and indexing cues when their audio events become due. */
  update() {
    if (!this.running) return;
    const now = this.sound.context.currentTime;
    while (this.shiftQueue.length && this.shiftQueue[0].when <= now) {
      const shift = this.shiftQueue.shift();
      this.onIndex?.(shift.turn, now - shift.when);
    }
    while (this.queue.length && this.queue[0].when <= now) {
      const strike = this.queue.shift();
      this.onStrike(strike.event, now - strike.when);
    }

    const depletion = Math.max(0, now - this.lastAudioTime) * this.speed /
      (this.spec.duration * TRANSPORT_TIMING.springRevolutions);
    this.virtualReserve = Math.max(0, this.virtualReserve - depletion);
    this.lastAudioTime = now;

    const reachedEnd = !this.loop && this.absoluteTime() >= getCylinderDuration(this.spec);
    if (reachedEnd || this.virtualReserve <= 0) {
      if (this.virtualReserve <= 0) this.sound.cancelScheduled?.(now);
      this.offset = this.virtualReserve <= 0 ? this.position() : getCylinderDuration(this.spec);
      this.running = false;
      clearInterval(this.timer);
      this.timer = null;
      this.queue = [];
      this.shiftQueue = [];
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
    this.shiftQueue = [];
    this.sound.silence();
  }

  async seek(time) {
    const wasPlaying = this.running;
    this.pause();
    this.offset = clamp(time, 0, getCylinderDuration(this.spec));
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
    this.onIndex = null;
  }
}
