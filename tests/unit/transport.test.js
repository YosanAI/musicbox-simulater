import test from 'node:test';
import assert from 'node:assert/strict';
import { Transport } from '../../src/audio/Transport.js';
import { validateCylinder } from '../../src/cylinder/validation.js';

function fixture(t) {
  const sound = {
    context: { currentTime: 0 }, scheduled: [], knocks: [], cancelled: [], silenceCount: 0,
    async init() { return this.context; },
    prepareNotes() {},
    strike(note, when) { this.scheduled.push({ note, when }); },
    indexKnock(when) { this.knocks.push(when); },
    cancelScheduled(after) { this.cancelled.push(after); },
    silence() { this.silenceCount++; },
  };
  const strikes = [];
  const endings = [];
  const shifts = [];
  const transport = new Transport(sound, (...args) => strikes.push(args), reason => endings.push(reason),
    (...args) => shifts.push(args));
  transport.setSpec(validateCylinder({
    duration: 8, notes: [{ tooth: 24, time: 0 }, { tooth: 28, time: 1 }],
  }));
  t.after(() => transport.dispose());
  return { sound, transport, strikes, endings, shifts };
}

test('notes use the audio clock and visuals wait for their scheduled strike', async t => {
  const { sound, transport, strikes } = fixture(t);
  await transport.play();
  assert.equal(sound.scheduled[0].when, 0.055);
  transport.update();
  assert.equal(strikes.length, 0);
  sound.context.currentTime = 0.055;
  transport.update();
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0][0].tooth, 24);
});

test('look-ahead scheduling does not duplicate a note', async t => {
  const { sound, transport } = fixture(t);
  await transport.play();
  sound.context.currentTime = 1;
  transport.schedule();
  transport.schedule();
  assert.equal(sound.scheduled.length, 2);
  assert.equal(sound.scheduled[1].when, 1.055);
});

test('pause preserves position, clears queued strikes and cancels the scheduler', async t => {
  const { sound, transport } = fixture(t);
  await transport.play();
  sound.context.currentTime = 2.055;
  transport.pause();
  assert(Math.abs(transport.position() - 2) < 1e-9);
  assert.equal(transport.running, false);
  assert.equal(transport.timer, null);
  assert.equal(transport.queue.length, 0);
});

test('seeking clamps to one revolution and restarts only when previously playing', async t => {
  const { transport } = fixture(t);
  await transport.seek(-5);
  assert.equal(transport.position(), 0);
  await transport.seek(999);
  assert.equal(transport.position(), 8);
  assert.equal(transport.running, false);
  await transport.play();
  await transport.seek(3);
  assert.equal(transport.running, true);
  assert.equal(transport.position(), 3);
});

test('speed changes preserve the current musical position', async t => {
  const { sound, transport } = fixture(t);
  await transport.play();
  sound.context.currentTime = 2.055;
  await transport.setSpeed(2);
  assert(Math.abs(transport.position() - 2) < 1e-9);
  sound.context.currentTime += 1.055;
  assert(Math.abs(transport.position() - 4) < 1e-9);
});

test('repeat schedules the next revolution with a wrapped visual playhead', async t => {
  const { sound, transport } = fixture(t);
  transport.loop = true;
  await transport.play();
  sound.context.currentTime = 8.02;
  transport.schedule();
  assert(sound.scheduled.some(strike => strike.note.time === 0 && strike.when === 8.055));
  sound.context.currentTime = 8.155;
  assert(Math.abs(transport.position() - 0.1) < 1e-9);
});

test('virtual reserve runs down in five revolutions at the current speed', async t => {
  const { sound, transport, endings } = fixture(t);
  transport.loop = true;
  await transport.play();
  sound.context.currentTime = 4.055;
  transport.update();
  assert(Math.abs(transport.virtualReserve - 0.9) < 1e-9);
  sound.context.currentTime = 40.055;
  transport.update();
  assert.equal(transport.virtualReserve, 0);
  assert.equal(transport.running, false);
  assert.deepEqual(endings, ['spring']);
  assert.deepEqual(sound.cancelled, [40.055]);
});

test('end-of-turn stops the transport but does not cut off decaying notes', async t => {
  const { sound, transport, endings } = fixture(t);
  await transport.play();
  const silenceCount = sound.silenceCount;
  sound.context.currentTime = 8.1;
  transport.update();
  assert.equal(transport.position(), 8);
  assert.equal(transport.running, false);
  assert.equal(sound.silenceCount, silenceCount);
  assert.deepEqual(sound.cancelled, []);
  assert.deepEqual(endings, ['end']);
});

test('an in-flight audio unlock cannot restart playback after pause', async t => {
  const { sound, transport } = fixture(t);
  let resume;
  sound.init = () => new Promise(resolve => { resume = resolve; });
  const playing = transport.play();
  transport.pause();
  resume(sound.context);
  await playing;
  assert.equal(transport.running, false);
  assert.equal(sound.scheduled.length, 0);
});

test('a cylinder swap resets position and reserve', async t => {
  const { sound, transport } = fixture(t);
  await transport.play();
  sound.context.currentTime = 2;
  transport.virtualReserve = 0.3;
  transport.setSpec(validateCylinder({ duration: 4, notes: [] }));
  assert.equal(transport.running, false);
  assert.equal(transport.position(), 0);
  assert.equal(transport.virtualReserve, 1);
  assert.equal(transport.timer, null);
});

function indexedFixture(t, notes = [{ tooth: 24, time: 0, turn: 0 }, { tooth: 28, time: 0, turn: 1 }, { tooth: 31, time: 0, turn: 2 }]) {
  const result = fixture(t);
  result.transport.setSpec(validateCylinder({ duration: 8, turns: 3, notes }));
  return result;
}

test('indexed playback strikes only the active track and knocks once on each audio-clock shift', async t => {
  const { sound, transport, endings } = indexedFixture(t);
  await transport.play();
  assert.deepEqual(sound.scheduled.map(strike => strike.note.turn), [0]);
  sound.context.currentTime = 8;
  transport.schedule();
  transport.schedule();
  assert.deepEqual(sound.knocks, [8.055]);
  assert.deepEqual(sound.scheduled.map(strike => strike.note.turn), [0, 1]);
  sound.context.currentTime = 16;
  transport.schedule();
  assert.deepEqual(sound.knocks, [8.055, 16.055]);
  sound.context.currentTime = 24.06;
  transport.update();
  assert.equal(transport.position(), 24);
  assert.deepEqual(endings, ['end']);
  assert.equal(sound.knocks.length, 2);
});

test('a manual seek selects its indexed track silently and schedules the next shift at the changed speed', async t => {
  const { sound, transport } = indexedFixture(t);
  await transport.seek(8);
  await transport.setSpeed(2);
  await transport.play();
  assert.equal(sound.scheduled[0].note.turn, 1);
  assert.deepEqual(sound.knocks, []);
  sound.context.currentTime = 4;
  transport.schedule();
  assert.deepEqual(sound.knocks, [4.055]);
  sound.context.currentTime = 4.055;
  await transport.setSpeed(0.5);
  transport.schedule();
  assert.equal(transport.position(), 16);
  assert.equal(sound.knocks.length, 1);
});

test('pause after an indexed shift and resume do not repeat its knock', async t => {
  const { sound, transport } = indexedFixture(t);
  await transport.play();
  sound.context.currentTime = 8;
  transport.schedule();
  sound.context.currentTime = 8.055;
  transport.pause();
  await transport.play();
  assert.equal(sound.knocks.length, 1);
  sound.context.currentTime = 16.055;
  transport.schedule();
  assert.equal(sound.knocks.length, 2);
  assert.equal(sound.knocks[1], 16.11);
});

test('repeat returns to the first indexed track with one knock while single-turn repeats remain silent', async t => {
  const { sound, transport } = indexedFixture(t);
  transport.loop = true;
  await transport.seek(23.9);
  await transport.play();
  sound.context.currentTime = 0.05;
  transport.schedule();
  assert.equal(sound.knocks.length, 1);
  assert(Math.abs(sound.knocks[0] - 0.155) < 1e-9);
  assert.equal(sound.scheduled[0].note.turn, 0);
  const single = fixture(t);
  single.transport.loop = true;
  await single.transport.seek(7.9);
  await single.transport.play();
  single.sound.context.currentTime = 0.05;
  single.transport.schedule();
  assert.deepEqual(single.sound.knocks, []);
});

test('silent indexed cylinders still advance with a knock and seeking clamps to the whole programme', async t => {
  const { sound, transport } = indexedFixture(t, []);
  await transport.seek(999);
  assert.equal(transport.position(), 24);
  await transport.play();
  sound.context.currentTime = 8;
  transport.schedule();
  assert.deepEqual(sound.knocks, [8.055]);
});

test('index animation waits for its audio clock and reports the age of a delayed frame', async t => {
  const { sound, transport, shifts } = indexedFixture(t);
  await transport.play();
  sound.context.currentTime = 8;
  transport.schedule();
  transport.update();
  assert.deepEqual(shifts, []);
  sound.context.currentTime = 8.08;
  transport.update();
  assert.equal(shifts.length, 1);
  assert.equal(shifts[0][0], 1);
  assert(Math.abs(shifts[0][1] - .025) < 1e-9);
  transport.update();
  assert.equal(shifts.length, 1);
});

test('pause and manual seeks cancel pending indexing animations', async t => {
  const { sound, transport, shifts } = indexedFixture(t);
  await transport.play();
  sound.context.currentTime = 8;
  transport.schedule();
  assert.equal(transport.shiftQueue.length, 1);
  transport.pause();
  assert.equal(transport.shiftQueue.length, 0);
  sound.context.currentTime = 8.1;
  transport.update();
  assert.deepEqual(shifts, []);
  await transport.seek(16);
  await transport.play();
  sound.context.currentTime = 8.2;
  transport.update();
  assert.deepEqual(shifts, []);
});

test('the repeat indexing animation identifies the first tune', async t => {
  const { sound, transport, shifts } = indexedFixture(t);
  transport.loop = true;
  await transport.seek(23.9);
  await transport.play();
  sound.context.currentTime = .05;
  transport.schedule();
  sound.context.currentTime = .16;
  transport.update();
  assert.equal(shifts.length, 1);
  assert.equal(shifts[0][0], 0);
});
