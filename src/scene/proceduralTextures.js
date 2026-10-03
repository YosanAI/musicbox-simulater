import { TAU } from '../math/scalars.js';
/** Seeded original wood grain and canvas-drawn engravings; no external texture files. */
export function woodTexture(renderer) {
  let canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  let context = canvas.getContext('2d');
  let imageData = context.createImageData(canvas.width, canvas.height);
  let pixels = imageData.data;
  let seed = 9307;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      let rand = (seed >>> 0) / 4294967296;
      let warp = 9 * Math.sin(y * .019) + 3 * Math.sin(y * .073 + x * .007);
      let grain = Math.sin((x + warp) * .105 + Math.sin(x * .021) * 2);
      let fine = Math.sin((x + warp) * .94 + y * .021);
      let bands = Math.sin(x * .027 + Math.sin(y * .014) * .45);
      let v = grain * .09 + fine * .025 + bands * .17 + rand * .05;
      let at = (y * canvas.width + x) * 4;
      pixels[at] = 130 + v * 110;
      pixels[at + 1] = 61 + v * 71;
      pixels[at + 2] = 26 + v * 42;
      pixels[at + 3] = 255;
    }
  }
  context.putImageData(imageData, 0, 0);
  return renderer.texture(canvas);
}
export function plaque(renderer, text, small = '') {
  let canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  let context = canvas.getContext('2d');
  let gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#d7be77');
  gradient.addColorStop(.5, '#f0d997');
  gradient.addColorStop(1, '#b39754');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 256);
  context.strokeStyle = '#554829';
  context.lineWidth = 3;
  context.strokeRect(14, 14, 996, 228);
  context.fillStyle = '#24211b';
  context.textAlign = 'center';
  context.font = 'italic 87px Georgia,serif';
  context.fillText(text, 512, small ? 120 : 160);
  if (small) {
    context.font = '23px Arial';
    context.letterSpacing = '5px';
    context.fillText(small, 512, 187);
  }
  return renderer.texture(canvas);
}
export function barrelLabel(renderer) {
  let canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  let context = canvas.getContext('2d');
  context.fillStyle = '#d3bd76';
  context.fillRect(0, 0, 512, 512);
  context.strokeStyle = '#978348';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(256, 256, 217, 0, TAU);
  context.stroke();
  const arc = (s, r, at, step) => {
    context.fillStyle = '#746131';
    context.font = '27px Georgia';
    context.textAlign = 'center';
    for (let i = 0; i < s.length; i++) {
      let a = at + (i - (s.length - 1) / 2) * step;
      context.save();
      context.translate(256 + Math.sin(a) * r, 256 - Math.cos(a) * r);
      context.rotate(a);
      context.fillText(s[i], 0, 0);
      context.restore();
    }
  };
  arc('SAINTE-CROIX', 159, 0, .12);
  arc('SWITZERLAND', 175, Math.PI, -.12);
  context.font = 'italic 28px Georgia';
  context.textAlign = 'center';
  context.fillText('Reuge', 256, 264);
  return renderer.texture(canvas);
}
