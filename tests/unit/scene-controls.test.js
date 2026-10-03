import test from 'node:test';
import assert from 'node:assert/strict';
import { OrbitCameraController, CAMERA_PRESETS, CAMERA_LIMITS } from '../../src/scene/OrbitCameraController.js';
import { distanceToSegment } from '../../src/scene/picking.js';

function canvasStub() {
  const listeners = new Map();
  return {
    clientWidth: 900,
    clientHeight: 600,
    classList: { add() {}, remove() {} },
    addEventListener(type, callback) { listeners.set(type, callback); },
    setPointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0 }; },
    dispatch(type, values = {}) {
      listeners.get(type)({ type, button: 0, pointerId: 1, clientX: 100, clientY: 100,
        shiftKey: false, preventDefault() {}, ...values });
    },
  };
}

test('right drag pans the camera without rotating or plucking a tine', () => {
  const canvas = canvasStub();
  const picks = [];
  const camera = new OrbitCameraController(canvas, point => picks.push(point));
  const initial = structuredClone(camera.state);
  canvas.dispatch('pointerdown', { button: 2 });
  canvas.dispatch('pointermove', { button: 2, clientX: 170, clientY: 140 });
  canvas.dispatch('pointerup', { button: 2, clientX: 170, clientY: 140 });
  assert.notDeepEqual(camera.state.target, initial.target);
  assert.equal(camera.state.yaw, initial.yaw);
  assert.equal(camera.state.pitch, initial.pitch);
  assert.deepEqual(picks, []);
  camera.dispose();
});

test('two fingers pan and pinch, without triggering a pluck when released', () => {
  const canvas = canvasStub();
  const picks = [];
  const camera = new OrbitCameraController(canvas, point => picks.push(point));
  const initial = structuredClone(camera.state);
  canvas.dispatch('pointerdown');
  canvas.dispatch('pointerdown', { pointerId: 2, clientX: 200 });
  canvas.dispatch('pointermove', { pointerId: 2, clientX: 240, clientY: 140 });
  assert.ok(camera.state.radius < initial.radius);
  assert.notDeepEqual(camera.state.target, initial.target);
  assert.equal(camera.state.yaw, initial.yaw);
  canvas.dispatch('pointerup', { pointerId: 2, clientX: 240, clientY: 140 });
  canvas.dispatch('pointerup');
  assert.deepEqual(picks, []);
  camera.dispose();
});

test('view resets a panned target even when yaw, pitch and radius already match', () => {
  const canvas = canvasStub();
  const camera = new OrbitCameraController(canvas, () => {});
  camera.pan(200, 100);
  camera.view('perspective');
  camera.update(1 / 60);
  assert.equal(camera.animating, true);
  for (let frame = 0; frame < 180; frame++) camera.update(1 / 60);
  assert.deepEqual(camera.state.target, CAMERA_PRESETS.perspective.target);
  camera.zoom(.00001);
  assert.equal(camera.state.radius, CAMERA_LIMITS.minRadius);
  camera.zoom(100000);
  assert.equal(camera.state.radius, CAMERA_LIMITS.maxRadius);
  camera.dispose();
});

test('tine picking covers the full projected length and chooses finite endpoints', () => {
  assert.equal(distanceToSegment([30, 40], [10, 20], [50, 60]), 0);
  assert.equal(distanceToSegment([5, 20], [10, 20], [50, 20]), 5);
  assert.equal(distanceToSegment([55, 20], [10, 20], [50, 20]), 5);
  assert.equal(distanceToSegment([10, 22], [10, 20], [10, 20]), 2);
});
