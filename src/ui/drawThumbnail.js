import { TAU } from '../math/scalars.js';
import { getPinPosition } from '../cylinder/pinGeometry.js';
/** The original brass cylinder thumbnail; the pins reflect the actual score. */
export function drawThumbnail(canvas, spec) {
  let pixelRatio = 2;
  let width = 73;
  let height = 39;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  let context = canvas.getContext('2d');
  context.scale(pixelRatio, pixelRatio);
  let gradient = context.createLinearGradient(0, 4, 0, 34);
  gradient.addColorStop(0, '#8c682e');
  gradient.addColorStop(.18, '#cab37d');
  gradient.addColorStop(.45, '#e6d69d');
  gradient.addColorStop(.59, '#b3904d');
  gradient.addColorStop(.8, '#82602c');
  gradient.addColorStop(1, '#322d22');
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(6, 7, 61, 24, 4);
  context.fill();
  context.strokeStyle = '#c8b174';
  context.lineWidth = .6;
  context.beginPath();
  context.ellipse(7, 19, 3.7, 12, 0, 0, TAU);
  context.stroke();
  context.beginPath();
  context.ellipse(66, 19, 2.2, 12, 0, 0, TAU);
  context.stroke();
  context.fillStyle = '#777b6e';
  for (let note of spec.notes) {
    let angle = getPinPosition(note, spec.duration).angle;
    if (Math.sin(angle) < -.2) {
      continue;
    }
    let pinX = 9 + note.tooth / 71 * 54;
    let pinY = 19 - Math.cos(angle) * 10;
    context.fillRect(pinX, pinY, .65, 1.1);
  }
  context.fillStyle = '#aba384';
  context.fillRect(2, 17, 4, 3);
  context.fillRect(68, 17, 4, 3);
}
