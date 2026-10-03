import { clamp } from '../math/scalars.js';
import { vec3 } from '../math/vectors.js';

/** Original camera framing and input sensitivity, intentionally not redesigned. */
export const CAMERA_PRESETS = {
  perspective: { yaw: 0.10, pitch: 0.67, radius: 0.62, target: [-0.005, 0.070, -0.006] },
  top: { yaw: 0, pitch: 1.52, radius: 0.49, target: [0, 0.025, -0.002] },
  comb: { yaw: 0.05, pitch: 0.74, radius: 0.31, target: [0.031, 0.052, 0.010] },
};
const copyPreset = preset => ({ ...preset, target: [...preset.target] });

/** Retains the original drag, pinch, scroll and eased camera-view transitions. */
export class OrbitCameraController {
  constructor(canvas, onPick) {
    this.canvas = canvas;
    this.onPick = onPick;
    this.state = copyPreset(CAMERA_PRESETS.perspective);
    this.goal = copyPreset(this.state);
    this.animating = false;
    this.pointers = new Map();
    this.lastDistance = 0;
    this.totalMotion = 0;
    this.start = null;
    this.events = new AbortController();
    this.bind();
  }

  view(name) {
    const preset = CAMERA_PRESETS[name];
    if (!preset) return;
    this.goal = copyPreset(preset);
    this.animating = true;
  }

  bind() {
    const canvas = this.canvas;
    const options = { signal: this.events.signal };
    canvas.addEventListener('pointerdown', event => {
      this.animating = false;
      this.pointers.set(event.pointerId, [event.clientX, event.clientY]);
      canvas.setPointerCapture(event.pointerId);
      this.start = [event.clientX, event.clientY];
      this.totalMotion = 0;
      this.lastDistance = 0;
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
        this.state.yaw -= dx * 0.007;
        this.state.pitch = clamp(this.state.pitch + dy * 0.006, 0.14, 1.54);
      } else {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (this.lastDistance) {
          this.state.radius = clamp(this.state.radius * this.lastDistance / distance, 0.15, 1.1);
        }
        this.lastDistance = distance;
      }
    }, options);

    const release = event => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size) return;
      canvas.classList.remove('dragging');
      if (this.totalMotion < 6 && this.start && event.type === 'pointerup') {
        const rectangle = canvas.getBoundingClientRect();
        this.onPick([event.clientX - rectangle.left, event.clientY - rectangle.top]);
      }
    };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      this.animating = false;
      this.state.radius = clamp(this.state.radius * Math.exp(event.deltaY * 0.001), 0.15, 1.1);
    }, { ...options, passive: false });
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options);
  }

  update(deltaSeconds) {
    const camera = this.state;
    if (this.animating) {
      const goal = this.goal;
      const amount = Math.min(1, deltaSeconds * 6);
      camera.yaw += (goal.yaw - camera.yaw) * amount;
      camera.pitch += (goal.pitch - camera.pitch) * amount;
      camera.radius += (goal.radius - camera.radius) * amount;
      camera.target = vec3.lerp(camera.target, goal.target, amount);
      if (Math.abs(camera.radius - goal.radius) + Math.abs(camera.pitch - goal.pitch) +
          Math.abs(camera.yaw - goal.yaw) < 0.001) this.animating = false;
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
