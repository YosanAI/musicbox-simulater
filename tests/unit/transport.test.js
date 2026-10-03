import test from 'node:test';
import assert from 'node:assert/strict';
import { Transport } from '../../src/audio/Transport.js';
import { validateCylinder } from '../../src/cylinder/validation.js';

function fixture(t) {
  const sound = {
    context: { currentTime: 0 }, scheduled: [], silenceCount: 0,
    async init() { return this.context; },
    prepareNotes() {},
    strike(note, when) { this.scheduled.push({ note, when }); },
    silence() { this.silenceCount++; },
  };
  const strikes = [];
  const endings = [];
  const transport = new Transport(sound, (...args) => strikes.push(args), reason => endings.push(reason));
  transport.setSpec(validateCylinder({
    duration: 8, notes: [{ tooth: 24, time: 0 }, { tooth: 28, time: 1 }],
  }));
  t.after(() => transport.dispose());
  return { sound, transport, strikes, endings };
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
