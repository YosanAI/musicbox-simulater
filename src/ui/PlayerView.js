import { formatTime } from './formatters.js';
import { drawTimeline } from './drawTimeline.js';
import { noteName, midiToFrequency } from '../cylinder/noteNames.js';
import { getCylinderDuration, getCylinderTurn } from '../cylinder/index.js';

/** Presentation only. Playback and the audio clock remain in Transport. */
export class PlayerView {
  constructor(elements, transport, scene, state) {
    this.elements = elements;
    this.transport = transport;
    this.scene = scene;
    this.state = state;
  }

  /** Restore DOM controls when development hot reload creates a fresh app. */
  resetControls() {
    const { elements, transport, scene } = this;
    elements.speed.value = transport.speed;
    elements.speedOut.textContent = `${transport.speed.toFixed(2)}×`;
    elements.repeat.checked = transport.loop;
    elements.highlights.checked = scene.highlights;
    elements.showResonance.checked = this.state.showResonance;
    elements.caseToggle.checked = scene.caseVisible;
    this.clearIndex();
    elements.labels.hidden = true;
    elements.labelsBtn.classList.remove('active');
    elements.explodeBtn.classList.remove('active');
    elements.explodeBtn.textContent = 'Explode';
    elements.explodeBtn.setAttribute('aria-pressed', 'false');
    elements.explodeBtn.setAttribute('aria-label', 'Explode the mechanism');
    for (const button of document.querySelectorAll('[data-view]')) {
      button.classList.toggle('active', button.dataset.view === 'perspective');
    }
  }

  refreshCylinder() {
    const { spec } = this.transport;
    const elements = this.elements;
    elements.nowTitle.textContent = spec.title;
    elements.totalTime.textContent = formatTime(getCylinderDuration(spec));
    elements.duration.value = String(Math.round(spec.duration * 100) / 100);
    const unit = document.createElement('span');
    unit.className = 'spec-unit';
    unit.textContent = 'PINS';
    elements.pinCount.replaceChildren(document.createTextNode(spec.notes.length), unit);
    elements.timeline.setAttribute('aria-valuemax', String(getCylinderDuration(spec)));
    elements.sourceBadge.textContent = spec.source.toUpperCase();
    elements.noteReadout.querySelector('strong').textContent = '—';
    elements.noteFrequency.textContent = 'Touch a comb tooth';
    elements.ejectBtn.querySelector('span').textContent = 'Lift';
    this.sync();
  }

  showStrike(note) {
    this.elements.noteReadout.querySelector('strong').textContent = noteName(note.midi);
    this.elements.noteFrequency.textContent =
      `${midiToFrequency(note.midi).toFixed(1)} Hz · tooth ${note.tooth + 1}`;
  }

  showIndex(turn, age = 0) {
    this.state.indexStarted = performance.now() / 1000 - age;
    this.elements.indexMessage.textContent = `Indexing · tune ${turn + 1} of ${this.transport.spec.turns}`;
    this.elements.indexCue.classList.add('active');
    this.elements.turnOut.classList.add('indexing');
  }

  clearIndex() {
    this.state.indexStarted = -100;
    this.elements.indexCue.classList.remove('active');
    this.elements.turnOut.classList.remove('indexing');
    this.elements.indexMessage.textContent = '';
  }

  sync() {
    const { transport, scene, elements } = this;
    const ejected = scene.liftTarget > 0;
    const button = elements.playBtn;
    button.querySelector('use').setAttribute('href', transport.running ? '#i-pause' : '#i-play');
    button.setAttribute('aria-label', transport.running ? 'Pause' : 'Play');
    button.disabled = this.state.busy || ejected || scene.swapping;

    let status = 'WOUND & READY';
    if (ejected) status = 'CYLINDER LIFTED';
    else if (scene.swapping) status = 'MOUNTING CYLINDER';
    else if (transport.running) status = 'THE MOVEMENT IS PLAYING';
    else if (transport.virtualReserve <= 0) status = 'SPRING EMPTY · WIND TO PLAY';
    else if (transport.position() >= getCylinderDuration(transport.spec) - 0.01) status = 'CYLINDER COMPLETE';
    else if (transport.position() > 0) status = 'PAUSED';
    elements.playStatus.textContent = status;
  }

  update() {
    const { elements, transport } = this;
    const position = transport.position();
    if (this.state.indexStarted > -100 &&
        performance.now() / 1000 - this.state.indexStarted >= 1.1) this.clearIndex();
    drawTimeline(elements.timeline, transport.spec, position, {
      strikes: this.state.showResonance ? this.state.resonances : [],
      now: performance.now() / 1000,
      speed: transport.speed,
    });
    elements.currentTime.textContent = formatTime(position);
    this.sync();
    elements.rpm.textContent = (60 * transport.speed / transport.spec.duration).toFixed(2);
    const turn = getCylinderTurn(transport.spec, position);
    elements.turnOut.textContent = `${turn + 1} / ${transport.spec.turns}`;
    const tune = transport.spec.tunes?.[turn];
    elements.turnOut.title = tune?.title || `Tune ${turn + 1}`;
    elements.nowTitle.textContent = tune?.title || transport.spec.title;
    const reserve = Math.round(transport.virtualReserve * 100);
    elements.reserveOut.textContent = `${reserve}%`;
    elements.reserveBar.style.width = `${reserve}%`;
  }
}
