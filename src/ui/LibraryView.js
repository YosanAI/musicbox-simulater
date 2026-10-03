import { drawThumbnail } from './drawThumbnail.js';
import { formatTime } from './formatters.js';
import { EventScope } from './dom.js';

export class LibraryView {
  constructor(elements, onSelect) {
    this.elements = elements;
    this.onSelect = onSelect;
    this.events = new EventScope();
  }

  render(entries, activeIndex) {
    this.events.dispose();
    this.events = new EventScope();
    const parent = this.elements.library;
    parent.replaceChildren();

    entries.forEach((entry, index) => {
      const { spec } = entry;
      const button = document.createElement('button');
      button.className = 'cylinder-card' + (index === activeIndex ? ' selected' : '');
      button.setAttribute('aria-pressed', String(index === activeIndex));
      button.title = `${spec.title} — ${spec.composer}`;
      const canvas = document.createElement('canvas');
      canvas.className = 'cylinder-thumb';
      canvas.setAttribute('aria-hidden', 'true');
      const text = document.createElement('div');
      const title = document.createElement('span');
      const subtitle = document.createElement('span');
      const number = document.createElement('span');
      title.className = 'cylinder-title';
      title.textContent = spec.title;
      subtitle.className = 'cylinder-sub';
      const turns = spec.turns || 1;
      subtitle.textContent = `${spec.notes.length} pins · ${turns} tune${turns > 1 ? 's' : ''} · ${formatTime(spec.duration)}/turn`;
      number.className = 'cylinder-index';
      number.textContent = String(index + 1).padStart(2, '0');
      text.append(title, subtitle);
      button.append(canvas, text, number);
      parent.append(button);
      drawThumbnail(canvas, spec);
      this.events.on(button, 'click', () => this.onSelect(index));
    });

    this.elements.libraryCount.textContent = String(entries.length).padStart(2, '0');
  }

  dispose() {
    this.events.dispose();
  }
}
