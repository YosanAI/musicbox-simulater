import { synthesizeTine } from './tineSynthesis.js';
import { renderCylinderWav } from './wavExport.js';

/** Web Audio voice pool and the original dry/wet room-resonance graph. */
export class SoundEngine {
  constructor() {
    this.context = null;
    this.cache = new Map();
    this.active = new Set();
    this.volume = 0.72;
    this.resonance = 0.30;
    this.lidOpen = true;
    this.startedNotes = 0;
    this.disposed = false;
  }

  /** Must be reached from a user gesture to unlock browser audio. */
  async init() {
    if (this.disposed) throw new Error('The sound engine has been disposed.');
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
      this.context = new AudioContextClass({ latencyHint: 'interactive' });
      this.createGraph();
    }
    if (this.context.state !== 'running') await this.context.resume();
    return this.context;
  }

  createGraph() {
    const context = this.context;
    this.input = context.createGain();
    this.dry = context.createGain();
    this.dry.gain.value = 0.87;
    this.wet = context.createGain();
    this.wet.gain.value = this.resonance;
    this.filter = context.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 13000;
    this.filter.Q.value = 0.4;
    this.master = context.createGain();
    this.master.gain.value = this.volume * 0.6;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 15;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;
    this.convolver = context.createConvolver();
    this.convolver.buffer = this.createRoomImpulse();

    this.input.connect(this.dry).connect(this.filter);
    this.input.connect(this.convolver).connect(this.wet).connect(this.filter);
    this.filter.connect(this.compressor).connect(this.master).connect(context.destination);
  }

  /** Seeded noise keeps the room impulse deterministic. */
  createRoomImpulse() {
    const context = this.context;
    const impulse = context.createBuffer(2, Math.floor(context.sampleRate * 1.8), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const samples = impulse.getChannelData(channel);
      let seed = 713 + channel;
      for (let index = 0; index < samples.length; index++) {
        seed = (Math.imul(seed, 1103515245) + 12345) | 0;
        const seconds = index / context.sampleRate;
        samples[index] = ((seed >>> 0) / 4294967296 * 2 - 1) *
          Math.exp(-seconds * 4.1) * 0.3 * (1 - Math.exp(-seconds * 70));
      }
    }
    return impulse;
  }

  getNoteBuffer(midi) {
    if (!this.cache.has(midi)) {
      const samples = synthesizeTine(midi, this.context.sampleRate);
      const buffer = this.context.createBuffer(1, samples.length, this.context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.cache.set(midi, buffer);
    }
    return this.cache.get(midi);
  }

  prepareNotes(notes) {
    if (!this.context) return;
    for (const midi of new Set(notes.map(note => note.midi))) this.getNoteBuffer(midi);
  }

  strike(note, when = this.context?.currentTime) {
    if (!this.context || this.disposed) return;
    const context = this.context;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const pan = context.createStereoPanner();
    source.buffer = this.getNoteBuffer(note.midi);
    pan.pan.value = (note.tooth / 71 - 0.5) * 1.25;
    gain.gain.value = note.velocity * 0.68;
    source.connect(gain).connect(pan).connect(this.input);

    const voice = { source, gain, pan, when };
    this.active.add(voice);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.active.delete(voice);
    };
    source.start(Math.max(when, context.currentTime));
    this.startedNotes++;
    return voice;
  }

  /** Fade voices quickly rather than introducing a click at pause or seek. */
  silence() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.active) {
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(0, now, 0.007);
        voice.source.stop(now + 0.04);
      } catch {
        // A source may already have ended between scheduling and this call.
      }
    }
  }

  setVolume(volume) {
    this.volume = volume;
    this.master?.gain.setTargetAtTime(volume * 0.6, this.context.currentTime, 0.03);
  }

  setResonance(resonance) {
    this.resonance = resonance;
    this.wet?.gain.setTargetAtTime(resonance, this.context.currentTime, 0.04);
  }

  setLid(open) {
    this.lidOpen = open;
    this.filter?.frequency.setTargetAtTime(open ? 13000 : 2100, this.context.currentTime, 0.3);
  }

  renderWav(spec, speed = 1) {
    return renderCylinderWav(spec, speed);
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.silence();
    for (const voice of this.active) {
      try { voice.source.stop(); } catch { /* Already stopped. */ }
      voice.source.disconnect();
      voice.gain.disconnect();
      voice.pan.disconnect();
    }
    this.active.clear();
    this.cache.clear();
    if (this.context && this.context.state !== 'closed') await this.context.close();
  }
}
