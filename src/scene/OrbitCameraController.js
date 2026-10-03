import { clamp } from '../math/scalars.js';
import { vec3 } from '../math/vectors.js';

/** Camera views frame the movement closely while keeping the comb accessible. */
export const CAMERA_PRESETS = {
  perspective: { yaw: 0.10, pitch: 0.67, radius: 0.49, target: [-0.005, 0.070, -0.006] },
  top: { yaw: 0, pitch: 1.52, radius: 0.39, target: [0, 0.025, -0.002] },
  comb: { yaw: 0.05, pitch: 0.74, radius: 0.25, target: [0.031, 0.052, 0.010] },
  exploded: { yaw: 0.10, pitch: 0.65, radius: 0.65, target: [-0.015, 0.110, 0.004] },
};
export const CAMERA_LIMITS = { minRadius: 0.085, maxRadius: 1.4 };
const copyPreset = preset => ({ ...preset, target: [...preset.target] });

/** Orbit, pan, pinch and eased camera-view transitions. */
export class OrbitCameraController {
  constructor(canvas, onPick) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.state = copyPreset(CAMERA_PRESETS.perspective);
    this.goal = copyPreset(this.state);
    this.animationOrigin = copyPreset(this.state);
    this.animationElapsed = 0;
    this.animationStarted = 0;
    this.animating = false;
    this.pointers = new Map();
    this.lastDistance = 0;
    this.totalMotion = 0;
    this.start = null;
    this.panning = false;
    this.pickEligible = false;
    this.events = new AbortController();
    this.bind();
  }

  view(name) {
    const preset = CAMERA_PRESETS[name];
    if (!preset) return;
    this.goal = copyPreset(preset);
    this.animationOrigin = copyPreset(this.state);
    this.animationElapsed = 0;
    this.animationStarted = performance.now() / 1000;
    this.animating = true;
  }

  zoom(factor) {
    this.state.radius = clamp(this.state.radius * factor,
      CAMERA_LIMITS.minRadius, CAMERA_LIMITS.maxRadius);
  }

  pan(dx, dy) {
    const { yaw, pitch, radius } = this.state;
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const distance = radius * Math.max(1, 1.25 / aspect);
    const metresPerPixel = 2 * distance * Math.tan(18 * Math.PI / 180) /
      Math.max(1, this.canvas.clientHeight);
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch),
      -Math.cos(yaw) * Math.sin(pitch)];
    this.state.target = this.state.target.map((value, axis) =>
      value + (-dx * right[axis] + dy * up[axis]) * metresPerPixel);
  }

  bind() {
    const canvas = this.canvas;
    const options = { signal: this.events.signal };
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 && event.button !== 2) return;
      this.animating = false;
      const firstPointer = this.pointers.size === 0;
      this.pointers.set(event.pointerId, [event.clientX, event.clientY]);
      canvas.setPointerCapture(event.pointerId);
      if (firstPointer) {
        this.start = [event.clientX, event.clientY];
        this.totalMotion = 0;
        this.panning = event.button === 2 || event.shiftKey;
        this.pickEligible = !this.panning;
      } else {
        this.pickEligible = false;
      }
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.lastDistance = Math.hypot(a[0] - b[0], a[1] - b[1]);
      } else {
        this.lastDistance = 0;
      }
      canvas.classList.add('dragging');
    }, options);

    canvas.addEventListener('pointermove', event => {
      if (!this.pointers.has(event.pointerId)) return;
      const previous = this.pointers.get(event.pointerId);
      const dx = event.clientX - previous[0];
      const dy = event.clientY - previous[1];
      this.totalMotion += Math.hypot(dx, dy);
      this.pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (this.pointers.size === 1) {
        if (this.panning || event.shiftKey) {
          this.pickEligible = false;
          this.pan(dx, dy);
        } else {
          this.state.yaw -= dx * 0.007;
          this.state.pitch = clamp(this.state.pitch + dy * 0.006, 0.14, 1.54);
        }
      } else {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
        this.pan(dx / this.pointers.size, dy / this.pointers.size);
        if (this.lastDistance && distance > 0) this.zoom(this.lastDistance / distance);
        this.lastDistance = distance;
      }
    }, options);

    const release = event => {
      this.pointers.delete(event.pointerId);
      this.lastDistance = 0;
      if (this.pointers.size) return;
      canvas.classList.remove('dragging');
      if (this.pickEligible && this.totalMotion < 6 && this.start && event.type === 'pointerup') {
        const rectangle = canvas.getBoundingClientRect();
        this.onPick([event.clientX - rectangle.left, event.clientY - rectangle.top]);
      }
    };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.animating = false;
      this.zoom(Math.exp(event.deltaY * 0.001));
    }, { ...options, passive: false });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options);
  }

  update(deltaSeconds) {
    const camera = this.state;
    if (this.animating) {
      const goal = this.goal;
      this.animationElapsed += deltaSeconds;
      const elapsed = Math.max(this.animationElapsed, performance.now() / 1000 - this.animationStarted);
      const progress = Math.min(1, elapsed / .7);
      const amount = progress * progress * (3 - 2 * progress);
      const origin = this.animationOrigin;
      camera.yaw = origin.yaw + (goal.yaw - origin.yaw) * amount;
      camera.pitch = origin.pitch + (goal.pitch - origin.pitch) * amount;
      camera.radius = origin.radius + (goal.radius - origin.radius) * amount;
      camera.target = vec3.lerp(origin.target, goal.target, amount);
      if (progress === 1) {
        Object.assign(camera, copyPreset(goal));
        this.animating = false;
      }
    }
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const framing = Math.max(1, 1.25 / aspect);
    const distance = camera.radius * framing;
    const eye = vec3.add(camera.target, [
      distance * Math.sin(camera.yaw) * Math.cos(camera.pitch),
      distance * Math.sin(camera.pitch),
      distance * Math.cos(camera.yaw) * Math.cos(camera.pitch),
    ]);
    return { eye, target: camera.target };
  }

  dispose() {
    this.events.abort();
    this.pointers.clear();
    this.canvas.classList.remove('dragging');
  }
}
