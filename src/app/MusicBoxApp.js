import { SoundEngine } from '../audio/SoundEngine.js';
import { Transport } from '../audio/Transport.js';
import {
  createDemoCylinders, validateCylinder, exportCylinderGLB, decodeGLB, interpretCylinderGLTF, getNoteTime,
} from '../cylinder/index.js';
import { readCylinderFile } from '../io/cylinderFiles.js';
import { Downloads } from '../io/download.js';
import { collectElements, EventScope } from '../ui/dom.js';
import { Notifications } from '../ui/Notifications.js';
import { LibraryView } from '../ui/LibraryView.js';
import { PlayerView } from '../ui/PlayerView.js';
import { WorkshopController } from '../ui/WorkshopController.js';
import { bindPlayerControls } from '../ui/bindPlayerControls.js';
import { bindViewControls } from '../ui/bindViewControls.js';
import { bindFileControls } from '../ui/bindFileControls.js';

/**
 * Composition and use cases, not a renderer or synthesizer.
 * A scene factory keeps this boundary injectable for integration tests.
 */
export class MusicBoxApp {
  constructor({ createScene }) {
    this.elements = collectElements();
    this.events = new EventScope();
    this.notifications = new Notifications(this.elements.toast);
    this.downloads = new Downloads();
    this.state = {
      ready: false, busy: false, lastNote: null, importMode: null, labelsOn: false,
      showResonance: false, resonances: [], indexStarted: -100,
    };
    this.library = createDemoCylinders().map(spec => ({ spec, meshes: null }));
    this.activeIndex = 0;
    this.frame = 0;
    this.animationFrame = null;
    this.lastFrameTime = performance.now();
    this.disposed = false;

    this.sound = new SoundEngine();
    this.scene = createScene(
      this.elements.sceneCanvas,
      this.notifications.guard(tooth => this.audition(tooth)),
      () => this.wind(),
    );
    this.transport = new Transport(this.sound, (note, age) => this.onStrike(note, age), reason => {
      this.playerView.sync();
      if (reason === 'spring') {
        this.notifications.show('The virtual spring has run down. Wind it to continue.');
      }
    }, (turn, age) => {
      this.scene.index(age);
      this.playerView.showIndex(turn, age);
    });
    this.playerView = new PlayerView(this.elements, this.transport, this.scene, this.state);
    this.libraryView = new LibraryView(
      this.elements, this.notifications.guard(index => this.loadEntry(index)),
    );
    this.tick = this.tick.bind(this);
  }

  start() {
    this.playerView.resetControls();
    this.elements.volume.value = this.sound.volume;
    this.elements.resonance.value = this.sound.resonance;
    this.elements.resonanceOut.textContent = `${Math.round(this.sound.resonance * 100)}%`;
    bindPlayerControls(this);
    bindViewControls(this);
    bindFileControls(this);
    this.workshop = new WorkshopController({
      elements: this.elements,
      events: this.events,
      notifications: this.notifications,
      getSpec: () => this.transport.spec,
      pause: () => this.pause(),
      audition: tooth => this.audition(tooth),
      apply: spec => {
        this.addEntry(spec);
        this.notifications.show(`Created ${spec.notes.length} physical pins. Play it, or export a GLB.`);
      },
    });
    if (innerWidth <= 850) this.elements.settingsPanel.open = false;
    this.loadEntry(0, false);
    this.state.ready = true;
    this.elements.loading.classList.add('done');
    this.lastFrameTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.tick);
    this.installDiagnostics();
    return this;
  }

  loadSpec(spec, meshes = null, animate = true) {
    if (this.disposed) return null;
    const normalized = validateCylinder(spec);
    this.transport.setSpec(normalized);
    this.scene.setCylinder(normalized, meshes, animate);
    this.state.lastNote = null;
    this.state.resonances = [];
    this.playerView.clearIndex();
    this.playerView.refreshCylinder();
    return normalized;
  }

  loadEntry(index, animate = true) {
    if (this.state.busy || this.disposed) return;
    const entry = this.library[index];
    if (!entry) throw new Error(`No cylinder at library index ${index}.`);
    this.activeIndex = index;
    this.loadSpec(entry.spec, entry.meshes, animate);
    this.refreshLibrary();
    if (animate) this.notifications.show(`Mounted “${entry.spec.title}”.`);
  }

  addEntry(spec, meshes = null) {
    if (this.disposed) return;
    this.library.push({ spec, meshes });
    this.activeIndex = this.library.length - 1;
    this.loadSpec(spec, meshes, true);
    this.refreshLibrary();
  }

  refreshLibrary() {
    this.libraryView.render(this.library, this.activeIndex);
  }

  pause() {
    this.transport.pause();
    this.state.resonances = [];
    this.playerView.clearIndex();
    this.playerView.sync();
  }

  reset() {
    this.transport.reset();
    this.state.resonances = [];
    this.playerView.clearIndex();
    this.scene.renderer.shadowDirty = true;
    this.playerView.sync();
  }

  async togglePlay() {
    if (this.scene.liftTarget > 0) {
      this.notifications.show('Mount the cylinder before playing.');
      return;
    }
    if (this.state.busy || this.scene.swapping || this.disposed) return;
    if (this.transport.running) {
      this.pause();
      return;
    }
    if (this.transport.virtualReserve <= 0) {
      this.notifications.show('Wind the spring to continue.');
      return;
    }
    this.state.busy = true;
    this.playerView.sync();
    try {
      await this.transport.play();
    } finally {
      this.state.busy = false;
      if (!this.disposed) this.playerView.sync();
    }
  }

  async audition(tooth) {
    await this.sound.init();
    if (this.disposed) return;
    const note = { midi: this.transport.spec.tuning[tooth], tooth, velocity: 0.8, time: 0 };
    this.sound.strike(note, this.sound.context.currentTime);
    this.onStrike(note);
  }

  onStrike(note, age = 0) {
    this.scene.strike(note, age);
    this.state.lastNote = note;
    const buffer = this.sound.getNoteBuffer(note.midi);
    this.state.resonances.push({
      note, position: note.turn === undefined ? this.transport.position()
        : getNoteTime(note, this.transport.spec),
      started: performance.now() / 1000 - age,
      duration: buffer.duration + (this.sound.resonance > 0 ? 1.8 : 0),
    });
    this.playerView.showStrike(note);
  }

  wind() {
    this.transport.virtualReserve = 1;
    this.scene.wind();
    this.notifications.show('Virtual spring wound · five revolutions of reserve.', false, 2700);
    this.playerView.sync();
  }

  changeDuration(duration) {
    const oldDuration = this.transport.spec.duration;
    if (!Number.isFinite(duration) || duration < 2 || duration > 600) {
      this.elements.duration.value = oldDuration;
      throw new Error('A revolution must be 2–600 seconds.');
    }
    const spec = validateCylinder({
      ...this.transport.spec,
      duration,
      notes: this.transport.spec.notes.map(note => ({
        ...note, time: note.time / oldDuration * duration,
      })),
    });
    this.library[this.activeIndex].spec = spec;
    this.loadSpec(spec, this.library[this.activeIndex].meshes, false);
    this.refreshLibrary();
    this.notifications.show('Revolution duration updated. The physical pin positions are unchanged.');
  }

  async importFile(file) {
    if (!file || this.disposed) return;
    if (this.state.busy) throw new Error('Wait for the current action to finish before loading a cylinder.');
    this.pause();
    this.state.busy = true;
    this.playerView.sync();
    this.notifications.show('Reading cylinder geometry…', false, 12000);
    try {
      // Let the reading notification paint before a large geometry parse.
      await new Promise(resolve => setTimeout(resolve, 40));
      const result = await readCylinderFile(file);
      if (this.disposed) return;
      this.state.importMode = result.mode;
      this.addEntry(result.spec, result.meshes);
      this.notifications.show(result.detail, false, 8500);
    } finally {
      this.state.busy = false;
      if (!this.disposed) this.playerView.sync();
    }
  }

  tick(now) {
    if (this.disposed) return;
    try {
      const delta = Math.min(0.08, (now - this.lastFrameTime) / 1000);
      this.lastFrameTime = now;
      this.transport.update();
      const seconds = performance.now() / 1000;
      this.state.resonances = this.state.resonances.filter(strike =>
        seconds - strike.started < strike.duration);
      this.scene.update(delta, this.transport.position(), this.transport.running);
      this.frame++;
      if (this.frame % 2 === 0) {
        this.playerView.update();
        if (this.state.labelsOn) this.updateLabels();
      }
      this.animationFrame = requestAnimationFrame(this.tick);
    } catch (error) {
      this.fail(error);
    }
  }

  updateLabels() {
    for (const [index, element] of Array.from(this.elements.labels.children).entries()) {
      const point = this.scene.getLabelPoint(index);
      const [x, y] = this.scene.renderer.project(point);
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  }

  installDiagnostics() {
    // A deliberate debugging API, not the old shared Crescendo namespace.
    this.diagnostics = {
      app: this,
      scene: this.scene,
      sound: this.sound,
      transport: this.transport,
      library: this.library,
      state: this.state,
      loadSpec: (...args) => this.loadSpec(...args),
      importFile: file => this.importFile(file),
      exportGLB: exportCylinderGLB,
      decodeGLB,
      interpretGLTF: interpretCylinderGLTF,
      getDiagnostics: () => ({
        ready: this.state.ready,
        renderer: this.scene.renderer.backend,
        revision: this.scene.renderer.revision,
        teeth: this.scene.teeth.length,
        pins: this.transport.spec.notes.length,
        position: this.transport.position(),
        running: this.transport.running,
        audioState: this.sound.context?.state || 'not-started',
        synthesizedBuffers: this.sound.cache.size,
        scheduledNotes: this.sound.startedNotes,
        activeVoices: this.sound.active.size,
        drawCalls: this.scene.renderer.drawCalls,
        shadowMap: this.scene.renderer.shadowSize,
        glError: this.scene.renderer.gl.getError(),
        importMode: this.state.importMode,
      }),
    };
    window.__CRESCENDO__ = this.diagnostics;
  }

  fail(error) {
    console.error(error);
    this.state.ready = false;
    cancelAnimationFrame(this.animationFrame);
    this.transport.pause();
    const message = document.createElement('span');
    message.textContent = `Could not start: ${error.message}`;
    this.elements.loading.replaceChildren(message);
    this.elements.loading.classList.remove('done');
    this.elements.loading.style.padding = '30px';
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.state.ready = false;
    cancelAnimationFrame(this.animationFrame);
    this.events.dispose();
    this.libraryView.dispose();
    this.notifications.dispose();
    this.downloads.dispose();
    this.transport.dispose();
    this.scene.dispose();
    void this.sound.dispose();
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    if (window.__CRESCENDO__ === this.diagnostics) delete window.__CRESCENDO__;
  }
}
