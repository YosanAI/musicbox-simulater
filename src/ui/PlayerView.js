import { formatTime } from './formatters.js';
import { drawTimeline } from './drawTimeline.js';
import { noteName, midiToFrequency } from '../cylinder/noteNames.js';

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
    elements.caseToggle.checked = scene.caseVisible;
    elements.labels.hidden = true;
    elements.labelsBtn.classList.remove('active');
    for (const button of document.querySelectorAll('[data-view]')) {
      button.classList.toggle('active', button.dataset.view === 'perspective');
    }
  }

  refreshCylinder() {
    const { spec } = this.transport;
    const elements = this.elements;
    elements.nowTitle.textContent = spec.title;
    elements.totalTime.textContent = formatTime(spec.duration);
    elements.duration.value = String(Math.round(spec.duration * 100) / 100);
    const unit = document.createElement('span');
    unit.className = 'spec-unit';
    unit.textContent = 'PINS';
    elements.pinCount.replaceChildren(document.createTextNode(spec.notes.length), unit);
    elements.timeline.setAttribute('aria-valuemax', String(spec.duration));
    elements.sourceBadge.textContent = spec.source.toUpperCase();
    elements.noteReadout.querySelector('strong').textContent = '—';
    elements.noteFrequency.textContent = 'Touch a comb tip';
    elements.ejectBtn.querySelector('span').textContent = 'Lift';
    this.sync();
  }

  showStrike(note) {
    this.elements.noteReadout.querySelector('strong').textContent = noteName(note.midi);
    this.elements.noteFrequency.textContent =
      `${midiToFrequency(note.midi).toFixed(1)} Hz · tooth ${note.tooth + 1}`;
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
    else if (transport.position() >= transport.spec.duration - 0.01) status = 'REVOLUTION COMPLETE';
    else if (transport.position() > 0) status = 'PAUSED';
    elements.playStatus.textContent = status;
  }

  update() {
    const { elements, transport } = this;
    const position = transport.position();
    drawTimeline(elements.timeline, transport.spec, position);
    elements.currentTime.textContent = formatTime(position);
    this.sync();
    elements.rpm.textContent = (60 * transport.speed / transport.spec.duration).toFixed(2);
    const reserve = Math.round(transport.virtualReserve * 100);
    elements.reserveOut.textContent = `${reserve}%`;
    elements.reserveBar.style.width = `${reserve}%`;
  }
}
