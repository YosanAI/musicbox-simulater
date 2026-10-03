import { noteName } from '../cylinder/noteNames.js';
/** The editing grid never quantizes an existing score just by displaying it. */
export function drawEditor(canvas, editor) {
  if (!editor) {
    return;
  }
  let step = 13;
  let row = 18;
  let left = 58;
  let top = 27;
  let width = left + editor.steps * step + 1;
  let height = top + 72 * row;
  let pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  let context = canvas.getContext('2d');
  context.scale(pixelRatio, pixelRatio);
  context.fillStyle = '#141c17';
  context.fillRect(0, 0, width, height);
  for (let rowIndex = 0; rowIndex < 72; rowIndex++) {
    let tooth = 71 - rowIndex;
    let midi = editor.tuning[tooth];
    let black = [1, 3, 6, 8, 10].includes(midi % 12);
    let y = top + rowIndex * row;
    context.fillStyle = black ? '#111a14' : '#1b251d';
    context.fillRect(left, y, width - left, row);
    context.fillStyle = black ? '#1a231b' : '#333b2e';
    context.fillRect(0, y, left - 2, row - 1);
    context.fillStyle = midi % 12 === 0 ? '#e7ce8a' : '#9aaa8b';
    context.font = (midi % 12 === 0 ? 'bold ' : '') + '10px Arial';
    context.textAlign = 'right';
    context.fillText(noteName(midi), left - 10, y + 12);
    context.fillStyle = '#c6d0b608';
    context.fillRect(left, y, width - left, 1);
  }
  for (let i = 0; i <= editor.steps; i++) {
    let pinX = left + i * step;
    context.fillStyle = i % 8 === 0 ? '#80926955' : '#80926918';
    context.fillRect(pinX, top, 1, height - top);
    if (i % 8 === 0) {
      context.fillStyle = '#9baa85';
      context.font = '8px Arial';
      context.textAlign = 'left';
      context.fillText((i / editor.steps * editor.duration).toFixed(1) + 's', pinX + 3, 17);
    }
  }
  for (let note of editor.notes) {
    if ((note.turn || 0) !== editor.turn) continue;
    let pinX = left + note.time / editor.duration * (width - left - 1);
    let pinY = top + (71 - note.tooth) * row + 3;
    context.fillStyle = '#d5b577';
    context.beginPath();
    context.roundRect(pinX + 1, pinY, 9, 12, 2);
    context.fill();
    context.fillStyle = '#ffedd055';
    context.fillRect(pinX + 3, pinY + 2, 2, 7);
  }
}
