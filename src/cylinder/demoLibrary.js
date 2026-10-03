import { validateCylinder } from './validation.js';

// Documented Reuge repertoire, independently arranged from public-domain themes.
// These abridged scores are not factory pin transcriptions: see docs/REPERTOIRE.md.
const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DURATION = 36;
function pitch(name) {
  const [, letter, accidental, octave] = /^([A-G])([#b]?)(\d)$/.exec(name);
  return (+octave + 1) * 12 + PITCH[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}
function air(title, composer, melody, chords, meter = 3, beat = .48) {
  return { title, composer, melody, chords, meter, beat };
}
function arrangeAir(tune, turn) {
  const notes = [];
  const phrase = tune.melody.trim().split(/\s+/).map(token => {
    const [name, length = '1'] = token.split(':');
    return { midi: name === 'R' ? null : pitch(name), length: +length };
  });
  const phraseSeconds = phrase.reduce((sum, note) => sum + note.length, 0) * tune.beat;
  // The leading clearance lets the comb align after the cylinder changes position.
  for (let start = .3; start + phraseSeconds <= DURATION - 1; start += phraseSeconds) {
    let time = start;
    phrase.forEach((note, i) => {
      if (note.midi !== null) notes.push({ midi: note.midi, time, velocity: i % 4 ? .72 : .82, turn });
      time += note.length * tune.beat;
    });
  }
  const barSeconds = tune.meter * tune.beat;
  for (let bar = 0; .3 + (bar + 1) * barSeconds < DURATION - 1; bar++) {
    const chord = tune.chords[bar % tune.chords.length].split(' ').map(pitch);
    const time = .3 + bar * barSeconds;
    notes.push({ midi: chord[0], time, velocity: .43, turn });
    for (let step = 1; step < tune.meter * 2; step++) {
      notes.push({ midi: chord[1 + (step - 1) % (chord.length - 1)], time: time + step * tune.beat / 2, velocity: step % 2 ? .31 : .36, turn });
    }
  }
  return notes;
}
function cylinder(title, composer, catalogue, tunes) {
  return validateCylinder({
    title, composer: `${composer} · simulator arrangement`,
    source: `${catalogue} repertoire · independent abridged arrangement`,
    duration: DURATION, turns: tunes.length,
    tunes: tunes.map(({ title: tuneTitle, composer: tuneComposer }) => ({ title: tuneTitle, composer: tuneComposer })),
    notes: tunes.flatMap(arrangeAir),
  });
}

export function createDemoCylinders() {
  const beethoven = 'L. van Beethoven';
  const strauss = 'J. Strauss II';
  const mozart = 'W. A. Mozart';
  const tchaikovsky = 'P. I. Tchaikovsky';
  const eliseChords = ['A2 E3 A3 C4', 'E2 E3 G#3 B3', 'A2 E3 A3 C4', 'C3 G3 C4 E4'];
  const elise = cylinder('Für Elise · three parts', beethoven, 'Reuge CH 3.72 / 37220', [
    air('Für Elise · part I', beethoven,
      'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1 R:.5 C4:.5 E4:.5 A4:.5 B4:1 R:.5 E4:.5 G#4:.5 B4:.5 C5:1 R:.5 E4:.5 E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1 R:.5 C4:.5 E4:.5 A4:.5 B4:1 R:.5 E4:.5 C5:.5 B4:.5 A4:2', eliseChords, 3, .5),
    air('Für Elise · part II', beethoven,
      'B4:.5 C5:.5 D5:.5 E5:1.5 G4:.5 F5:.5 E5:.5 D5:1.5 F4:.5 E5:.5 D5:.5 C5:1.5 E4:.5 D5:.5 C5:.5 B4:1 E4:.5 E5:.5 R:1 E5:.5 E6:.5 R:1 D#5:.5 E5:1 R:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:2', eliseChords, 3, .5),
    air('Für Elise · part III', beethoven,
      'C5:2 F5:.75 E5:.25 E5:1 D5:1 Bb5:.75 A5:.25 A5:.5 G5:.5 F5:.5 E5:.5 D5:.5 C5:.5 Bb4:1 A4:1 G4:.25 A4:.25 Bb4:.25 C5:2 D5:.5 D#5:.5 E5:1.5 E5:.5 F5:.5 A4:.5 C5:2 D5:.75 B4:.25 C5:3 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:2',
      ['F2 C3 F3 A3', 'Bb2 F3 Bb3 D4', 'F2 C3 F3 A3', 'G2 D3 G3 B3', ...eliseChords], 3, .5),
  ]);
  const vienna = cylinder('Strauss · Viennese waltzes', strauss, 'Reuge INTER CH 15.72 / 1001-1', [
    air('The Blue Danube', strauss,
      'D4:1 D4:1 F#4:1 A4:1 A4:2 F#5:1 F#5:2 D5:1 D5:2 D4:1 D4:1 F#4:1 A4:1 A4:2 G5:1 G5:2 C#5:1 C#5:2 C#4:1 C#4:1 E4:1 B4:1 B4:2 G5:1 G5:2 C#5:1 C#5:2 C#4:1 C#4:1 E4:1 B4:1 B4:2 F#5:1 F#5:2 D5:1 D5:2',
      ['D2 A3 D4 F#4', 'D2 A3 D4 F#4', 'A2 A3 C#4 E4', 'A2 A3 C#4 E4']),
    air('Tales from the Vienna Woods', strauss,
      'C6:2.5 C6:.25 B5:.25 C6:2.5 C6:.25 B5:.25 C6:1 R:1 E6:1 E6:2.5 E6:.25 D6:.25 D6:2.5 D6:.25 C6:.25 C6:2.5 C6:.25 B5:.25',
      ['F2 C4 F4 A4', 'F2 C4 F4 A4', 'Bb2 D4 F4 Bb4', 'C3 E4 G4 Bb4'], 3, .34),
    air("The Artist's Life", strauss,
      'C6:1 R:1 C6:1 C6:2 C6:.5 B5:.5 B5:2 A5:1 D5:1 R:1 A5:.5 R:.5 A5:1 R:1 A5:1 A5:2 A5:.5 G5:.5 G5:2 F5:1 D5:1 R:1 D5:.5 E5:.5',
      ['C3 G3 C4 E4', 'C3 G3 C4 E4', 'G2 G3 B3 D4', 'G2 G3 B3 D4'], 3, .38),
  ]);
  const opera = cylinder('Bizet & Verdi · opera airs', 'G. Bizet / G. Verdi', 'Reuge INTER CH 15.72 / 1001-2', [
    air('Carmen · Toréador', 'G. Bizet',
      'C5:1 D5:.75 C5:.25 A4:1 A4:1 A4:.75 G4:.25 A4:.75 Bb4:.25 A4:1.5 R:.5 Bb4:1 G4:.75 C5:.25 A4:1.5 R:.5 F4:1 D4:.75 G4:.25 C4:1.5 R:.5 G4:2 G4:.5 D5:.5 C5:.5 Bb4:.5 A4:.5 G4:.5 A4:.5 Bb4:.5 A4:1.5 R:.5 E4:1 A4:1 A4:1 G#4:.75 B4:.25 E5:4 E5:.5 D5:.5 C5:.5 D5:.5 G4:.5 A4:.5 Bb4:1',
      ['F2 C3 F3 A3', 'F2 C3 F3 A3', 'C3 E3 G3 C4', 'C3 E3 G3 C4'], 4, .46),
    air('Rigoletto · La donna è mobile', 'G. Verdi',
      'F#5:1 F#5:.5 G#5:.5 A#5:.5 R:.5 A#5:1 G#5:.5 E5:.5 C#5:1 E5:1 D#5:.5 R:.5 D#5:1 C#5:.5 E5:.5 G#5:.5 R:.5 F#5:1 R:1 F#5:1 F#5:.5 G#5:.5 A#5:.5 R:.5 A#5:1 G#5:.5 E5:.5 C#5:1 E5:1 D#5:.5 R:.5 D#5:1 C#5:.5 E5:.5 G#5:.5 R:.5 F#5:2',
      ['B2 F#3 B3 D#4', 'F#2 F#3 A#3 C#4', 'F#2 F#3 A#3 C#4', 'B2 F#3 B3 D#4']),
    air('La Traviata · Prelude', 'G. Verdi',
      'E5:2 D#5:1 C#5:1 B4:1.5 A4:.5 F#4:1 R:1 E5:2 D#5:1 C#5:1 B4:1.5 A4:.5 F#4:1 R:1 G#5:2 A5:1.5 G#5:.5 F#5:.75 E5:.25 F#5:.75 E5:.25 D#5:.75 C#5:.25 D#5:.75 C#5:.25 C#5:1 B4:.5 R:.5 G#5:1.5 F#5:.5 E#5:3',
      ['E2 B3 E4 G#4', 'B2 B3 D#4 F#4', 'E2 B3 E4 G#4', 'C#3 G#3 C#4 E4'], 4, .5),
  ]);
  const mozartCylinder = cylinder('Mozart · The Magic Flute & Andante', mozart, 'Reuge INTER CH 15.72 / 1001-3', [
    air('The Magic Flute · The Birdcatcher', mozart,
      'B4:.25 A4:.25 G4:.5 G4:.5 A4:.25 G4:.25 F#4:.25 G4:.25 A4:.5 B4:.5 A4:.5 A4:.25 G4:.25 D4:.75 D4:.25 D5:.75 D5:.25 B4:.5 A4:.5 G4:.5 G4:.25 B4:.25 A4:.25 G4:.25 F#4:.25 G4:.25 A4:.25 G4:.25 F#4:.25 G4:.25 A4:.5 B4:.5 A4:.5 A4:.5 D5:.75 D5:.25 A4:.75 A4:.25 G4:.5 F#4:.5 E4:.5 E4:.25 G4:.25',
      ['G2 D3 G3 B3', 'D3 A3 D4 F#4', 'D3 A3 D4 F#4', 'G2 D3 G3 B3'], 2, .48),
    air('Andante · Sonata in A major, K. 331', mozart,
      'C#5:.75 D5:.25 C#5:.5 E5:1 E5:.5 B4:.75 C#5:.25 B4:.5 D5:1 D5:.5 A4:1 A4:.5 B4:1 B4:.5 C#5:1 E5:.25 D5:.25 C#5:1 B4:.5 C#5:.75 D5:.25 C#5:.5 E5:1 E5:.5 B4:.75 C#5:.25 B4:.5 D5:1 D5:.5 A4:1 B4:.5 C#5:1 D5:.5 C#5:1 B4:.5 A4:1 R:.5',
      ['A2 E3 A3 C#4', 'E3 G#3 B3 E4', 'F#2 C#3 F#3 A3', 'A2 E3 A3 C#4'], 3, .6),
    air('The Magic Flute · Glockenspiel', mozart,
      'G5:.5 F5:.5 E5:1 E5:1 R:1 E5:1 F5:1 F5:1 R:1 F5:.5 E5:.5 D5:1 D5:1 R:1 D5:1 E5:2 R:1 E5:.5 F5:.5 G5:2 G5:1 G5:1 A5:1.5 B5:.5 C6:1 F5:1 E5:2 D5:1 D5:1 C5:2 R:1 G5:1 G5:2 A5:1 B5:1 C6:2 R:1 G5:1 G5:2 F5:1 D5:1 C5:2 R:2',
      ['C3 G3 C4 E4', 'G2 G3 B3 D4', 'C3 G3 C4 E4', 'F2 A3 C4 F4'], 4, .44),
  ]);
  const romantic = cylinder('Schumann & Schubert · romantic airs', 'R. Schumann / F. Schubert', 'Reuge INTER CH 15.72 / 1001-4', [
    air('Of Foreign Lands and Peoples', 'R. Schumann',
      'B4:1 G5:1 F#5:.75 E5:.25 D5:1 B4:1 G5:1 F#5:.75 E5:.25 D5:1 B4:1 G5:1 E5:.75 D5:.25 C5:1 A4:1 D5:1 B4:2 B4:1 C5:1 A4:1 B4:1 G4:1 A4:1 F#4:1 G4:1 E4:1 F#4:1 G4:.75 A4:.25 B4:.75 C5:.25 D5:1',
      ['G2 D3 G3 B3', 'D3 A3 D4 F#4', 'G2 D3 G3 B3', 'C3 E3 G3 C4'], 2, .56),
    air('The Trout', 'F. Schubert',
      'Ab4:.5 Db5:.5 Db5:.5 F5:.5 F5:.5 Db5:1 Ab4:.5 Ab4:.5 Ab4:.75 Ab4:.25 Eb5:.25 Db5:.25 C5:.25 Bb4:.25 Ab4:1 R:.5 Ab4:.5 Db5:.5 Db5:.5 F5:.5 F5:.5 Db5:1 Ab4:.5 Db5:.5 C5:.5 Bb4:.25 C5:.25 Db5:.5 G4:.5 Ab4:1 R:.5 Ab4:.5 C5:.5 C5:.5 Db5:.25 C5:.25 Bb4:.25 C5:.25 Db5:1 Ab4:.5 Db5:.5 C5:.5 C5:.5 C5:.25 Gb5:.25 Eb5:.25 C5:.25 Db5:1.5',
      ['Db3 Ab3 Db4 F4', 'Ab2 Eb3 Ab3 C4', 'Db3 Ab3 Db4 F4', 'Gb2 Db3 Gb3 Bb3'], 2, .48),
    air('Der Lindenbaum', 'F. Schubert',
      'B4:.5 B4:1.5 G#4:.5 G#4:.5 G#4:.5 G#4:1 E4:1 R:.5 E4:.5 F#4:1.5 G#4:.5 A4:.333 G#4:.333 F#4:.334 E4:2 R:.5 B4:.5 B4:1.5 G#4:.5 G#4:.5 G#4:.5 G#4:1 E4:1 R:.5 E4:.5 F#4:1.5 G#4:.5 A4:.333 G#4:.333 F#4:.334 E4:2 R:.5 E4:.5 F#4:1.5 F#4:.5 F#4:.5 F#4:.5 G#4:.75 A4:.25 B4:1.5 B4:.5 C#5:1.5 B4:.5 G#4:.5 E4:.5 F#4:2',
      ['E2 B3 E4 G#4', 'E2 B3 E4 G#4', 'B2 F#3 B3 D#4', 'E2 B3 E4 G#4'], 3, .5),
  ]);
  const ballet = cylinder('Tchaikovsky · ballet airs', tchaikovsky, 'Reuge INTER CH 15.72 / 1001-5', [
    air('Sleeping Beauty · Waltz', tchaikovsky,
      'Eb5:3 D5:3 Eb5:2 C5:1 D5:1 Eb5:1 C5:1 D5:2 F5:1 G5:2 E5:1 F5:6',
      ['Eb3 Bb3 Eb4 G4', 'Bb2 F3 Bb3 D4', 'Ab2 Eb3 Ab3 C4', 'Bb2 F3 Bb3 D4'], 3, .46),
    air('March of the Toy Soldiers', tchaikovsky,
      'D5:.5 R:.5 D5:.333 D5:.333 D5:.334 E5:.5 R:.5 E5:.5 R:.5 F#5:.5 R:.5 D5:.5 R:.5 E5:2 D5:.5 R:.5 D5:.333 D5:.333 D5:.334 E5:.5 R:.5 E5:.5 R:.5 F#5:.5 R:.5 D5:.5 R:.5 E5:2 C5:.75 R:.25 D5:.25 C5:.75 R:.25 B4:.25 A4:.75 R:.25 G4:.25 F#4:.75 R:.25 D4:.25',
      ['G2 D3 G3 B3', 'D3 A3 D4 F#4', 'G2 D3 G3 B3', 'C3 G3 C4 E4'], 4, .43),
    air('Waltz of the Flowers', tchaikovsky,
      'A4:1 C#5:1 E5:1 F#5:2 E5:1 E5:3 C#5:1 E5:1 C#5:1 A4:1 C#5:1 E5:1 A5:2 G5:1 G5:3 E5:1 G5:1 E5:1 C#5:1 E5:1 G5:1 B5:2 F#5:1 A5:2 G5:1 G5:2 D#5:1 F#5:2 E5:1 E5:2 B4:1 D5:1 C#5:1 B4:1 A4:3',
      ['A2 E3 A3 C#4', 'D3 A3 D4 F#4', 'E3 B3 E4 G#4', 'A2 E3 A3 C#4'], 3, .43),
  ]);
  return [elise, vienna, opera, mozartCylinder, romantic, ballet];
}
