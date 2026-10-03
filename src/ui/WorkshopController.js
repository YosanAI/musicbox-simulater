import { clamp } from '../math/scalars.js';
import { validateCylinder } from '../cylinder/validation.js';
import { drawEditor } from './drawEditor.js';

/** A draft score is isolated from the mounted cylinder until Apply is pressed. */
export class WorkshopController {
  constructor({ elements, events, notifications, getSpec, pause, audition, apply }) {
    this.elements = elements;
    this.getSpec = getSpec;
    this.pause = pause;
    this.audition = audition;
    this.apply = apply;
    this.editor = null;
    const guard = action => notifications.guard(action);
    events.on(elements.workshopBtn, 'click', () => this.open());
    events.on(elements.editSteps, 'change', () => {
      this.editor.steps = Number(elements.editSteps.value);
      this.draw();
    });
    events.on(elements.editDuration, 'change', guard(() => this.changeDuration()));
    events.on(elements.clearEditor, 'click', () => {
      this.editor.notes = [];
      this.draw();
    });
    events.on(elements.editorCanvas, 'click', guard(event => this.editPin(event)));
    events.on(elements.applyEditor, 'click', guard(() => this.commit()));
  }

  open() {
    this.pause();
    const spec = this.getSpec();
    this.editor = {
      notes: spec.notes.map(note => ({ ...note })),
      tuning: [...spec.tuning],
      duration: spec.duration,
      steps: 128,
      title: `${spec.title} · edit`,
    };
    const elements = this.elements;
    elements.editTitle.value = this.editor.title;
    elements.editDuration.value = this.editor.duration;
    elements.editSteps.value = '128';
    elements.workshopDialog.showModal();
    this.draw();
    const maxTooth = Math.max(36, ...this.editor.notes.map(note => note.tooth));
    elements.editorScroll.scrollTop = Math.max(0, (71 - maxTooth - 3) * 18);
  }

  draw() {
    drawEditor(this.elements.editorCanvas, this.editor);
    this.elements.editPinCount.textContent = `${this.editor.notes.length} pins`;
  }

  changeDuration() {
    const duration = Number(this.elements.editDuration.value);
    if (!Number.isFinite(duration) || duration < 2 || duration > 600) {
      this.elements.editDuration.value = this.editor.duration;
      throw new Error('Use a duration between 2 and 600 seconds.');
    }
    for (const note of this.editor.notes) note.time = note.time / this.editor.duration * duration;
    this.editor.duration = duration;
    this.draw();
  }

  async editPin(event) {
    if (!this.editor) return;
    const bounds = this.elements.editorCanvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const row = Math.floor((y - 27) / 18);
    const tooth = 71 - row;
    if (tooth < 0 || tooth > 71) return;
    if (x < 58) {
      await this.audition(tooth);
      return;
    }

    const column = clamp(Math.floor((x - 58) / 13), 0, this.editor.steps - 1);
    const time = column / this.editor.steps * this.editor.duration;
    const tolerance = this.editor.duration / this.editor.steps * 0.52;
    const existing = this.editor.notes.findIndex(note =>
      note.tooth === tooth && Math.abs(note.time - time) < tolerance);
    if (existing >= 0) {
      this.editor.notes.splice(existing, 1);
    } else {
      this.editor.notes.push({ tooth, midi: this.editor.tuning[tooth], time, velocity: 0.75 });
      await this.audition(tooth);
    }
    this.draw();
  }

  commit() {
    const spec = validateCylinder({
      title: this.elements.editTitle.value || 'Untitled cylinder',
      composer: 'Your custom arrangement',
      duration: this.editor.duration,
      tuning: this.editor.tuning,
      notes: this.editor.notes,
    });
    this.apply(spec);
    this.elements.workshopDialog.close();
  }
}
