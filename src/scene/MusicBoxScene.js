import { ThreeRenderer } from '../rendering/ThreeRenderer.js';
import { geometryBuilders } from '../geometry/primitives.js';
import { mat4 } from '../math/matrices.js';
import { TAU } from '../math/scalars.js';
import { TOOTH_COUNT } from '../cylinder/constants.js';
import { CYLINDER_INDEXING, getCylinderTurn } from '../cylinder/index.js';
import { createCylinderGeometry } from '../cylinder/pinGeometry.js';
import { createMaterialPalette } from './materialPalette.js';
import { MusicBoxBuilder } from './MusicBoxBuilder.js';
import { OrbitCameraController } from './OrbitCameraController.js';
import { createMainspringGeometry } from './mainspringGeometry.js';
import { distanceToSegment } from './picking.js';

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
    this.staticParts = model.staticParts;
    this.createExplodedParts = model.createExplodedParts;
    this.explodedParts = [];
    this.springParts = [];
    this.exploded = false;
    this.explosion = 0;
    this.explosionOrigin = 0;
    this.explosionElapsed = 0;
    this.explosionStarted = 0;
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
    this.axialShift = 0;
    this.previousTurn = 0;
    this.indexWrap = false;
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
    this.axialShift = 0;
    this.previousTurn = 0;
    this.indexWrap = false;
    this.renderer.shadowDirty = true;
  }

  setCase(visible) {
    this.caseVisible = visible;
    for (const part of this.caseParts) part.visible = visible && !this.explodedParts.length;
    for (const part of this.explodedParts) {
      if (part.casePart) part.node.visible = visible;
    }
    this.renderer.shadowDirty = true;
  }

  setExploded(exploded) {
    const next = Boolean(exploded);
    if (next === this.exploded) return;
    this.exploded = next;
    this.explosionOrigin = this.explosion;
    this.explosionElapsed = 0;
    this.explosionStarted = performance.now() / 1000;
    if (next) {
      if (!this.explodedParts.length) {
        this.explodedParts = this.createExplodedParts();
        for (const part of this.staticParts) part.visible = false;
        for (const part of this.explodedParts) {
          if (part.casePart) part.node.visible = this.caseVisible;
        }
      }
      this.springParts.push(this.renderer.add(createMainspringGeometry(), this.materials.steel,
        mat4.translation(-.170, .154, -.043), 'mainspring'));
      this.orbit.view('exploded');
    } else {
      // The coil is an inspection-only asset: release its mesh and GPU resources
      // as soon as the inspection is closed, even while other parts settle.
      for (const part of this.springParts) this.renderer.remove(part);
      this.springParts = [];
      this.orbit.view('perspective');
    }
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

  /** Mechanism label anchors follow the same exploded and indexed motion as their parts. */
  getLabelPoint(index) {
    const points = [[-.115, .075, -.033], [.034, .090, -.034], [.031, .055, .037]];
    const offsets = [[-.055, .035, -.01], [.025, .10, -.012], [0, .06, .055]];
    const point = points[index];
    if (!point) return null;
    return point.map((value, axis) => value + offsets[index][axis] * this.explosion +
      (index === 1 && axis === 0 ? this.axialShift : 0) +
      (index === 1 && axis === 1 ? this.lift : 0));
  }

  pick(point) {
    let nearestTooth = null;
    let bestDistance = 14;
    for (let index = 0; index < this.teeth.length; index++) {
      const tooth = this.teeth[index];
      const root = this.renderer.project(mat4.transformPoint(tooth.node.matrix, [0, .00055, 0]));
      const tip = this.renderer.project(mat4.transformPoint(tooth.node.matrix,
        [0, .00055, -tooth.length]));
      const distance = distanceToSegment(point, root, tip);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearestTooth = index;
      }
    }
    if (nearestTooth !== null) {
      this.onTooth(nearestTooth);
    } else {
      const barrel = this.renderer.project([-.115 - .055 * this.explosion,
        .073 + .035 * this.explosion, -.033 - .01 * this.explosion]);
      if (Math.hypot(point[0] - barrel[0], point[1] - barrel[1]) < 28) this.onWind();
    }
  }

  update(deltaSeconds, position, running) {
    const now = performance.now() / 1000;
    const phase = this.spec ? position / this.spec.duration * TAU : 0;
    let moved = running;
    const previousExplosion = this.explosion;
    const explosionGoal = this.exploded ? 1 : 0;
    if (this.explosion !== explosionGoal) {
      this.explosionElapsed += deltaSeconds;
      const elapsed = Math.max(this.explosionElapsed, now - this.explosionStarted);
      const progress = Math.min(1, elapsed / .65);
      const amount = progress * progress * (3 - 2 * progress);
      this.explosion = progress === 1 ? explosionGoal :
        this.explosionOrigin + (explosionGoal - this.explosionOrigin) * amount;
    }
    if (this.explosion !== previousExplosion) moved = true;
    for (const part of this.explodedParts) {
      part.node.matrix = mat4.translation(...part.offset.map(value => value * this.explosion));
    }
    if (!this.exploded && this.explosion === 0 && this.explodedParts.length) {
      for (const part of this.explodedParts) this.renderer.remove(part.node);
      this.explodedParts = [];
      for (const part of this.staticParts) part.visible = true;
      for (const part of this.caseParts) part.visible = this.caseVisible;
      moved = true;
    }
    const turn = this.spec ? getCylinderTurn(this.spec, position) : 0;
    const previousShift = this.axialShift;
    if (!running || !this.spec) {
      this.axialShift = -turn * CYLINDER_INDEXING.step;
      this.indexWrap = false;
    } else {
      if (turn === 0 && this.previousTurn > 0) this.indexWrap = true;
      const phaseTime = Math.max(0, position - turn * this.spec.duration);
      const progress = Math.min(1, phaseTime / CYLINDER_INDEXING.transitionSeconds);
      const amount = progress * progress * (3 - 2 * progress);
      this.axialShift = turn > 0 ? -(turn - 1 + amount) * CYLINDER_INDEXING.step :
        this.indexWrap ? -(this.spec.turns - 1) * (1 - amount) * CYLINDER_INDEXING.step : 0;
      if (progress === 1) this.indexWrap = false;
    }
    this.previousTurn = turn;
    if (this.axialShift !== previousShift) moved = true;
    const previousLift = this.lift;
    this.lift += (this.liftTarget - this.lift) * Math.min(1, deltaSeconds * 7);
    if (Math.abs(this.lift - this.liftTarget) < 0.00004) this.lift = this.liftTarget;
    if (previousLift !== this.lift) moved = true;
    if (this.swapping && this.lift < 0.001) this.swapping = false;

    const rotorMatrix = mat4.multiply(mat4.translation(
      this.rotorCenter[0] + this.axialShift + .025 * this.explosion,
      this.rotorCenter[1] + this.lift + .10 * this.explosion,
      this.rotorCenter[2] - .012 * this.explosion,
    ), mat4.rotationX(phase));
    for (const part of this.rotorParts) {
      part.matrix = rotorMatrix;
    }
    for (const [index, gear] of this.gears.entries()) {
      const angle = phase * gear.ratio;
      const at = [gear.at[0] - (.030 + index * .008) * this.explosion,
        gear.at[1] + (.060 + index * .008) * this.explosion,
        gear.at[2] + (index < 2 ? -.025 : .020) * this.explosion];
      gear.node.matrix = mat4.multiply(mat4.translation(...at),
        gear.axis === 'X' ? mat4.rotationX(angle) : mat4.rotationY(angle));
    }
    if (Math.abs(this.windTarget - this.windSpin) > 0.0001) {
      this.windSpin += (this.windTarget - this.windSpin) * Math.min(1, deltaSeconds * 4);
      moved = true;
    }
    this.windNode.matrix = mat4.multiply(mat4.translation(-.030 * this.explosion,
      .035 * this.explosion, .015 * this.explosion),
    mat4.multiply(this.windBase, mat4.rotationY(this.windSpin)));
    let tinesAnimating = false;
    for (let index = 0; index < TOOTH_COUNT; index++) {
      const tooth = this.teeth[index];
      const toothMatrix = mat4.multiply(mat4.translation(0, .06 * this.explosion,
        .055 * this.explosion), tooth.matrix);
      const age = now - this.tineStrikes[index];
      if (age < 1.6) {
        const amplitude = Math.exp(-age * 4.5) * Math.sin(age * (125 + index * 0.8)) * 0.014;
        tooth.node.matrix = mat4.multiply(toothMatrix, mat4.rotationX(amplitude));
        const highlight = this.highlights ? Math.exp(-age * 5) : 0;
        tooth.node.emission = [highlight * 0.50, highlight * 0.18, highlight * 0.025];
        tinesAnimating = true;
        moved = true;
      } else {
        tooth.node.matrix = toothMatrix;
        tooth.node.emission = [0, 0, 0];
      }
    }
    // Draw the final rest position after the last vibrating tine has settled.
    if (this.tinesAnimating && !tinesAnimating) moved = true;
    this.tinesAnimating = tinesAnimating;
    const camera = this.orbit.update(deltaSeconds);
    if (moved) this.renderer.shadowDirty = true;
    const view = [position, ...camera.eye, ...camera.target,
      this.canvas.clientWidth, this.canvas.clientHeight, window.devicePixelRatio || 1];
    // Keep the audio/UI animation loop alive without redrawing an idle movement.
    // Resizing, camera gestures and changes to the model invalidate this snapshot.
    if (!moved && !this.renderer.shadowDirty &&
        this.lastRenderedView?.every((value, index) => value === view[index])) return;
    this.renderer.render(camera.eye, camera.target);
    this.lastRenderedView = view;
  }

  dispose() {
    this.orbit.dispose();
    this.renderer.dispose();
  }
}
