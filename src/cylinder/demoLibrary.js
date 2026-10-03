import { validateCylinder } from './validation.js';
/** The exact three original miniature arrangements; no prerecorded audio. */
export function createDemoCylinders() {
  const make = (title, composer, duration, notes) => validateCylinder({
    title,
    composer,
    duration,
    notes
  });
  let notes = [];
  let beatSeconds = .54;
  let bassRoots = [50, 45, 47, 42, 43, 50, 43, 45];
  let chords = [
    [62, 66, 69],
    [61, 64, 69],
    [59, 62, 66],
    [57, 61, 66],
    [59, 62, 67],
    [57, 62, 66],
    [59, 62, 67],
    [61, 64, 69]
  ];
  const add = (midi, t, velocity = .7) => notes.push({ midi: midi, time: t, velocity: velocity });
  for (let c = 0; c < 24; c++) {
    let t = c * 4 * beatSeconds;
    let k = c % 8;
    add(bassRoots[k], t, .68);
    add(bassRoots[k] + 12, t + 2 * beatSeconds, .46);
    let chord = chords[k];
    for (let j = 0; j < 4; j++) {
      add(chord[[0, 1, 2, 1][j]], t + j * beatSeconds, .36);
    }
  }
  let firstMelody = [78, 76, 74, 73, 71, 69, 71, 73];
  let secondMelody = [74, 73, 71, 69, 67, 66, 67, 64];
  let variationMelody = [
    [66, 69, 74, 73, 71, 69, 71, 73],
    [74, 73, 71, 69, 67, 66, 67, 64],
    [62, 64, 66, 67, 69, 66, 69, 67],
    [66, 64, 66, 62, 64, 66, 67, 69],
    [71, 74, 73, 71, 69, 67, 66, 64],
    [66, 69, 74, 69, 66, 64, 62, 64],
    [67, 66, 64, 62, 59, 62, 67, 71],
    [69, 67, 66, 64, 61, 64, 69, 73]
  ];
  for (let k = 0; k < 8; k++) {
    add(firstMelody[k], (8 + k) * 4 * beatSeconds, .85);
    add(secondMelody[k], (8 + k) * 4 * beatSeconds + 2 * beatSeconds, .76);
    for (let j = 0; j < 8; j++) {
      add(variationMelody[k][j], (16 + k) * 4 * beatSeconds + j * beatSeconds / 2, .66 + (j % 4 === 0 ? .12 : 0));
    }
  }
  const canon = make('Canon in D', 'J. Pachelbel · miniature arrangement', 24 * 4 * beatSeconds + 2, notes);
  notes = [];
  let t = 0;
  const phrase = [
    [76, 1],
    [75, 1],
    [76, 1],
    [75, 1],
    [76, 1],
    [71, 1],
    [74, 1],
    [72, 1],
    [69, 3],
    [60, 1],
    [64, 1],
    [69, 1],
    [71, 3],
    [64, 1],
    [68, 1],
    [71, 1],
    [72, 3],
    [64, 1],
    [76, 1],
    [75, 1],
    [76, 1],
    [75, 1],
    [76, 1],
    [71, 1],
    [74, 1],
    [72, 1],
    [69, 3],
    [60, 1],
    [64, 1],
    [69, 1],
    [71, 3],
    [64, 1],
    [72, 1],
    [71, 1],
    [69, 5]
  ];
  for (let r = 0; r < 2; r++) {
    for (let [midi, d] of phrase) {
      notes.push({ midi: midi, time: t, velocity: .78 });
      if (d >= 3) {
        let bass = midi === 71 ? 40 : 45;
        notes.push({ midi: bass, time: t, velocity: .5 });
        notes.push({ midi: bass + 12, time: t + .26, velocity: .38 });
      }
      t += d * .26;
    }
  }
  const elise = make('Für Elise', 'L. van Beethoven · opening theme', t + 1, notes);
  notes = [];
  let chordProgression = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
  for (let i = 0; i < 16; i++) {
    let chord = chordProgression[i % 4];
    notes.push({ midi: chord[0] - 12, time: i * 2, velocity: .58 });
    for (let j = 0; j < 8; j++) {
      notes.push({ midi: chord[[0, 2, 1, 3, 2, 1, 3, 2][j]], time: i * 2 + j * .25, velocity: .52 });
      if (i > 7 && j % 2 === 0) {
        notes.push({ midi: chord[3] + 12, time: i * 2 + j * .25, velocity: .42 });
      }
    }
  }
  const garden = make('Clockwork garden', 'An original miniature · C major', 34, notes);
  return [canon, elise, garden];
}
