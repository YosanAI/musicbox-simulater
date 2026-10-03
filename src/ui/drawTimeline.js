import { getCylinderDuration } from '../cylinder/index.js';

/** Draw the unwrapped physical pin score and audio-driven decay trails. */
export function drawTimeline(canvas, spec, position, { strikes = [], now = 0, speed = 1 } = {}) {
  let pixelRatio = Math.min(devicePixelRatio || 1, 2);
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
  }
  let context = canvas.getContext('2d');
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  let notes = spec.notes;
  let duration = getCylinderDuration(spec);
  let playhead = position;
  let lowestTooth = Math.min(36, ...notes.map(note => note.tooth));
  let highestTooth = Math.max(lowestTooth + 8, ...notes.map(note => note.tooth));
  lowestTooth = Math.max(0, Math.min(...notes.map(note => note.tooth), 36) - 3);
  let pad = 4;
  let top = 6;
  let bottom = height - 12;
  let pitchHeight = bottom - top;
  context.strokeStyle = '#74866317';
  context.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    let noteX = pad + (width - pad * 2) * i / 8;
    context.beginPath();
    context.moveTo(noteX, 3);
    context.lineTo(noteX, bottom + 1);
    context.stroke();
  }
  for (let note of notes) {
    let time = note.time + (note.turn || 0) * spec.duration;
    let noteX = pad + time / duration * (width - pad * 2);
    let noteY = bottom - (note.tooth - lowestTooth) / (highestTooth - lowestTooth + 2) * pitchHeight;
    let played = time <= playhead;
    context.fillStyle = played ? '#d2b675aa' : '#83907566';
    let pinWidth = Math.max(1.6, Math.min(4, width / 400));
    context.fillRect(noteX, noteY, pinWidth, 1.9);
  }
  // Each trail keeps the voice's wall-clock age, so changing revolution speed
  // never prolongs the audible decay. Manual comb plucks appear at the playhead.
  for (const strike of strikes) {
    const age = Math.max(0, now - strike.started);
    if (age >= strike.duration) continue;
    const x = pad + Math.max(0, strike.position) / duration * (width - pad * 2);
    const length = Math.max(8, strike.duration * speed / duration * (width - pad * 2));
    const y = bottom - (strike.note.tooth - lowestTooth) /
      (highestTooth - lowestTooth + 2) * pitchHeight;
    const alpha = Math.exp(-age / strike.duration * 4) * (1 - age / strike.duration);
    const gradient = context.createLinearGradient(x, 0, x + length, 0);
    gradient.addColorStop(0, `rgba(237, 203, 133, ${alpha * 0.85})`);
    gradient.addColorStop(1, 'rgba(237, 203, 133, 0)');
    context.fillStyle = gradient;
    context.fillRect(x, y - 0.6, Math.max(0, Math.min(length, width - pad - x)), 3.2);
  }
  for (let turn = 1; turn < (spec.turns || 1); turn++) {
    const x = pad + turn * spec.duration / duration * (width - pad * 2);
    context.strokeStyle = '#d5b57755';
    context.setLineDash([2, 3]);
    context.beginPath();
    context.moveTo(x, 3);
    context.lineTo(x, bottom + 1);
    context.stroke();
    context.setLineDash([]);
  }
  let playheadX = pad + playhead / duration * (width - pad * 2);
  context.strokeStyle = '#dbc48c';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(playheadX, 2);
  context.lineTo(playheadX, bottom + 2);
  context.stroke();
  context.fillStyle = '#dbc48c';
  context.beginPath();
  context.moveTo(playheadX - 3, 1);
  context.lineTo(playheadX + 3, 1);
  context.lineTo(playheadX, 5);
  context.fill();
  context.fillStyle = '#6b7b61';
  context.font = '7px Arial';
  context.textAlign = 'right';
  context.fillText(`${spec.turns || 1} REVOLUTION${spec.turns > 1 ? 'S' : ''}`, width - 2, height - 1);
  canvas.setAttribute('aria-valuenow', playhead.toFixed(2));
}
