import { ThreeRenderer } from '../rendering/ThreeRenderer.js';
import { geometryBuilders } from '../geometry/primitives.js';
import { mat4 } from '../math/matrices.js';
import { TAU } from '../math/scalars.js';
import { TOOTH_COUNT } from '../cylinder/constants.js';
import { createCylinderGeometry } from '../cylinder/pinGeometry.js';
import { createMaterialPalette } from './materialPalette.js';
import { MusicBoxBuilder } from './MusicBoxBuilder.js';
import { OrbitCameraController } from './OrbitCameraController.js';

/** Owns the model and its visual motion; has no knowledge of DOM controls or sound synthesis. */
export class MusicBoxScene {
  constructor(canvas, onTooth, onWind) {
    this.canvas = canvas;
    this.onTooth = onTooth;
    this.onWind = onWind;
    this.renderer = new ThreeRenderer(canvas);
    this.materials = createMaterialPalette(this.renderer);
    const model = new MusicBoxBuilder(this.renderer, this.materials).build();
    this.teeth = model.teeth;
    this.gears = model.gears;
    this.caseParts = model.caseParts;
    this.windBase = model.windBase;
    this.windNode = model.windNode;
    this.rotorParts = [];
    this.spec = null;
    this.highlights = true;
    this.caseVisible = true;
    this.lift = 0;
    this.liftTarget = 0;
    this.swapping = false;
    this.rotorCenter = [0.030, 0.064, -0.034];
    this.tineStrikes = new Float64Array(TOOTH_COUNT).fill(-100);
    this.windSpin = 0;
    this.windTarget = 0;
    this.orbit = new OrbitCameraController(canvas, point => this.pick(point));
  }

  setCylinder(spec, importedMeshes = null, animate = true) {
    for (const part of this.rotorParts) this.renderer.remove(part);
    this.rotorParts = [];
    this.spec = spec;

    if (importedMeshes) {
      const groups = new Map();
      for (const entry of importedMeshes) {
        const pbr = entry.material?.pbrMetallicRoughness || {};
        const color = pbr.baseColorFactor || [0.77, 0.55, 0.24, 1];
        const key = JSON.stringify([color, pbr.metallicFactor, pbr.roughnessFactor]);
        if (!groups.has(key)) {
          groups.set(key, {
            items: [],
            material: {
              color: color.slice(0, 3),
              metal: pbr.metallicFactor ?? 0.9,
              rough: Math.max(0.12, pbr.roughnessFactor ?? 0.28),
              type: 2,
            },
          });
        }
        groups.get(key).items.push(entry.geometry);
      }
      for (const group of groups.values()) {
        this.rotorParts.push(this.renderer.add(
          geometryBuilders.merge(group.items), group.material, mat4.identity(), 'rotor',
        ));
      }
    } else {
      const geometry = createCylinderGeometry(spec);
      this.rotorParts.push(this.renderer.add(
        geometry.body, this.materials.gold, mat4.identity(), 'rotor',
      ));
      if (geometry.pins.indices.length) {
        this.rotorParts.push(this.renderer.add(
          geometry.pins, this.materials.steel, mat4.identity(), 'rotor',
        ));
      }
    }
    this.lift = animate ? 0.12 : 0;
    this.liftTarget = 0;
    this.swapping = animate;
    this.tineStrikes.fill(-100);
    this.renderer.shadowDirty = true;
  }

  setCase(visible) {
    this.caseVisible = visible;
    for (const part of this.caseParts) part.visible = visible;
    this.renderer.shadowDirty = true;
  }

  eject() {
    this.liftTarget = this.liftTarget > 0 ? 0 : 0.115;
    this.renderer.shadowDirty = true;
    return this.liftTarget > 0;
  }

  wind() { this.windTarget += TAU * 3; }
  strike(note, age = 0) { this.tineStrikes[note.tooth] = performance.now() / 1000 - age; }
  view(name) { this.orbit.view(name); }

  pick(point) {
    let nearestTooth = null;
    let bestDistance = 14;
    for (let index = 0; index < this.teeth.length; index++) {
      const projected = this.renderer.project(this.teeth[index].tip);
      const distance = Math.hypot(point[0] - projected[0], point[1] - projected[1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearestTooth = index;
      }
    }
    if (nearestTooth !== null) {
      this.onTooth(nearestTooth);
    } else {
      const barrel = this.renderer.project([-0.115, 0.073, -0.033]);
      if (Math.hypot(point[0] - barrel[0], point[1] - barrel[1]) < 28) this.onWind();
    }
  }

  update(deltaSeconds, position, running) {
    const now = performance.now() / 1000;
    const phase = this.spec ? position / this.spec.duration * TAU : 0;
    let moved = running;
    const previousLift = this.lift;
    this.lift += (this.liftTarget - this.lift) * Math.min(1, deltaSeconds * 7);
    if (Math.abs(this.lift - this.liftTarget) < 0.00004) this.lift = this.liftTarget;
    if (previousLift !== this.lift) moved = true;
    if (this.swapping && this.lift < 0.001) this.swapping = false;

    const rotorMatrix = mat4.multiply(mat4.translation(
      this.rotorCenter[0], this.rotorCenter[1] + this.lift, this.rotorCenter[2],
    ), mat4.rotationX(phase));
    for (const part of this.rotorParts) part.matrix = rotorMatrix;
    for (const gear of this.gears) {
      const angle = phase * gear.ratio;
      gear.node.matrix = mat4.multiply(mat4.translation(...gear.at),
        gear.axis === 'X' ? mat4.rotationX(angle) : mat4.rotationY(angle));
    }
    if (Math.abs(this.windTarget - this.windSpin) > 0.0001) {
      this.windSpin += (this.windTarget - this.windSpin) * Math.min(1, deltaSeconds * 4);
      this.windNode.matrix = mat4.multiply(this.windBase, mat4.rotationY(this.windSpin));
      moved = true;
    }
    for (let index = 0; index < TOOTH_COUNT; index++) {
      const tooth = this.teeth[index];
      const age = now - this.tineStrikes[index];
      if (age < 1.6) {
        const amplitude = Math.exp(-age * 4.5) * Math.sin(age * (125 + index * 0.8)) * 0.014;
        tooth.node.matrix = mat4.multiply(tooth.matrix, mat4.rotationX(amplitude));
        const highlight = this.highlights ? Math.exp(-age * 5) : 0;
        tooth.node.emission = [highlight * 0.50, highlight * 0.18, highlight * 0.025];
        moved = true;
      } else {
        tooth.node.matrix = tooth.matrix;
        tooth.node.emission = [0, 0, 0];
      }
    }
    const camera = this.orbit.update(deltaSeconds);
    if (moved) this.renderer.shadowDirty = true;
    this.renderer.render(camera.eye, camera.target);
  }

  dispose() {
    this.orbit.dispose();
    this.renderer.dispose();
  }
}
