/** Draw the unwrapped physical pin score and playhead without advancing time. */
export function drawTimeline(canvas, spec, position) {
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
  let duration = spec.duration;
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
    let noteX = pad + note.time / duration * (width - pad * 2);
    let noteY = bottom - (note.tooth - lowestTooth) / (highestTooth - lowestTooth + 2) * pitchHeight;
    let played = note.time <= playhead;
    context.fillStyle = played ? '#d2b675aa' : '#83907566';
    let pinWidth = Math.max(1.6, Math.min(4, width / 400));
    context.fillRect(noteX, noteY, pinWidth, 1.9);
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
  context.fillText('1 REVOLUTION', width - 2, height - 1);
  canvas.setAttribute('aria-valuenow', playhead.toFixed(2));
}
