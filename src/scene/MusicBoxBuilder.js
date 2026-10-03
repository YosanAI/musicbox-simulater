import { geometryBuilders } from '../geometry/primitives.js';
import { mat4 } from '../math/matrices.js';
import { TAU } from '../math/scalars.js';
import { CYLINDER_SHAPE } from '../cylinder/constants.js';
import { toLinearColor } from '../rendering/color.js';
/**
 * Procedural model assembly, in metres, copied from the supplied working demo.
 * Static pieces are grouped by material; comb teeth and gears remain separate
 * so they can animate. Change a component here without touching playback/UI.
 */
export class MusicBoxBuilder {
  constructor(renderer, materials) {
    this.renderer = renderer;
    this.materials = materials;
    this.staticParts = new Map();
    this.teeth = [];
    this.caseParts = [];
    this.gears = [];
  }
  build() {
    this.buildBase();
    this.buildLid();
    this.buildSpringBarrel();
    this.buildCylinderBearings();
    this.buildComb();
    this.buildControls();
    this.flushStaticParts();
    this.buildGears();
    this.buildWindingKey();
    return {
      teeth: this.teeth,
      caseParts: this.caseParts,
      gears: this.gears,
      windBase: this.windBase,
      windNode: this.windNode
    };
  }
  part(meshGeometry, material, transform = mat4.identity(), tag = 'fixed') {
    let key = tag + '_' + material.name;
    if (!this.staticParts.has(key)) {
      this.staticParts.set(key, { items: [], mat: material, tag });
    }
    this.staticParts.get(key).items.push({ geometry: meshGeometry, transform: transform });
  }
  box(width, height, depth, position, material, bevel = 0, tag = 'fixed', rotation = 0) {
    this.part(geometryBuilders.box(width, height, depth, bevel), material, mat4.multiply(mat4.translation(...position), mat4.rotationY(rotation)), tag);
  }
  screw(position, radius = .0037, tag = 'fixed', angle = 0) {
    let materials = this.materials;
    this.part(geometryBuilders.cylinder(radius, .0016, 24), materials.steel, mat4.translation(...position), tag);
    this.box(radius * 1.55, .00035, radius * .18, [position[0], position[1] + .00088, position[2]], materials.black, 0, tag, angle);
    this.part(geometryBuilders.torus(radius * .87, .00013, 24, 6), materials.gold, mat4.translation(position[0], position[1] + .0006, position[2]), tag);
  }
  buildBase() {
    const materials = this.materials;
    const renderer = this.renderer;
    // Table, feet, layered wooden plinth and fine brass inlay.
    let floor = renderer.add(geometryBuilders.box(4, .009, 4), {
      color: toLinearColor('#222428'),
      metal: .1,
      rough: .68,
      type: 4
    }, mat4.translation(0, -.018, 0), 'floor');
    floor.cast = false;
    for (let x of [-.139, .139]) {
      for (let z of [-.057, .072]) {
        this.part(geometryBuilders.cylinder(.012, .012, 32), materials.black, mat4.translation(x, -.005, z), 'case');
      }
    }
    this.box(.364, .014, .191, [0, .004, .005], materials.wood, .004, 'case');
    this.box(.349, .004, .182, [0, .013, .005], materials.edge, .0015, 'case');
    this.box(.347, .011, .179, [0, .020, .005], materials.wood, .003, 'case');
    this.box(.321, .003, .143, [0, .026, -.001], materials.woodDark, .001, 'case');
    this.box(.313, .0047, .137, [0, .029, -.001], materials.brass, .002);
    this.box(.311, .001, .135, [0, .0316, -.001], materials.gold, .001);
    for (let x of [-.153, .153]) {
      this.box(.0011, .0005, .128, [x, .0323, -.001], materials.edge);
    }
    for (let z of [-.064, .062]) {
      this.box(.302, .0005, .0011, [0, .0323, z], materials.edge);
    }
    for (let x of [-.146, .145]) {
      for (let z of [-.057, .054]) {
        this.screw([x, .033, z], .0021, 'fixed', x * 40 + z * 20);
      }
    }
  }
  buildLid() {
    const materials = this.materials;
    const renderer = this.renderer; // Open veneered lid with routed inner field. It is fixed open to expose the movement.
    let lid = mat4.multiply(mat4.translation(0, .027, -.087), mat4.rotationX(-1.85));
    this.part(geometryBuilders.box(.348, .009, .162, .003), materials.wood, mat4.multiply(lid, mat4.translation(0, 0, .078)), 'case');
    this.part(geometryBuilders.box(.322, .0014, .136, .002), materials.woodDark, mat4.multiply(lid, mat4.translation(0, -.0055, .078)), 'case');
    this.part(geometryBuilders.box(.313, .001, .127, .001), materials.wood, mat4.multiply(lid, mat4.translation(0, -.0064, .078)), 'case');
    for (let x of [-.105, .105]) {
      this.part(geometryBuilders.cylinder(.003, .045, 28), materials.gold, mat4.multiply(mat4.translation(x, .027, -.086), mat4.rotationZ(Math.PI / 2)), 'case');
      this.box(.037, .001, .014, [x, .027, -.075], materials.gold, 0, 'case');
      this.screw([x - .013, .028, -.073], .0015, 'case');
      this.screw([x + .013, .028, -.073], .0015, 'case');
    }
  }
  buildSpringBarrel() {
    const materials = this.materials;
    const renderer = this.renderer; // Left-hand mainspring barrel, rolled rims and cap.
    let bx = -.115;
    let bz = -.033;
    this.part(geometryBuilders.cylinder(.030, .0035, 72), materials.edge, mat4.translation(bx, .035, bz));
    this.part(geometryBuilders.cylinder(.0278, .032, 72), materials.gold, mat4.translation(bx, .054, bz));
    for (let y of [.038, .041, .068, .071]) {
      this.part(geometryBuilders.torus(.028, .0009, 72, 8), materials.brass, mat4.translation(bx, y, bz));
    }
    this.part(geometryBuilders.cylinder(.0277, .0013, 72), materials.brass, mat4.translation(bx, .072, bz));
    this.part(geometryBuilders.cylinder(.0257, .00025, 72), materials.barrelLabel, mat4.translation(bx, .0729, bz));
    this.screw([bx, .074, bz], .0042, 'fixed', .65);
  }
  buildCylinderBearings() {
    const materials = this.materials;
    const renderer = this.renderer; // Clamp arms for the removable cylinder, pivot nuts and axle bearings.
    for (let x of [-.080, .142]) {
      this.box(.010, .019, .015, [x, .043, -.034], materials.gold, .0018);
      this.box(.007, .020, .007, [x, .052, -.053], materials.brass, .001);
      this.part(geometryBuilders.cylinder(.006, .010, 32), materials.gold, mat4.multiply(mat4.translation(x, .064, -.034), mat4.rotationZ(Math.PI / 2)));
      this.part(geometryBuilders.cylinder(.0024, .017, 24), materials.steel, mat4.multiply(mat4.translation(x, .064, -.034), mat4.rotationZ(Math.PI / 2)));
      this.screw([x, .0365, -.018], .0035, 'fixed', x * 10);
    }
  }
  buildComb() {
    const materials = this.materials;
    const renderer = this.renderer; // Steel comb base. Low notes have longer teeth; all tips meet one contact line.
    this.box(.213, .013, .038, [.030, .038, .043], materials.black, .002);
    this.part(geometryBuilders.polygon([[-.076, .033], [.136, .012], [.136, .064], [-.076, .064]], .005), materials.steel, mat4.translation(0, .050, 0));
    this.box(.211, .002, .002, [.030, .048, .064], materials.darkSteel, .0004);
    let span = CYLINDER_SHAPE.maxX - CYLINDER_SHAPE.minX;
    for (let i = 0; i < 72; i++) {
      let u = i / 71;
      let x = .030 + CYLINDER_SHAPE.minX + span * u;
      let root = .033 - .021 * u;
      let tip = -.0108;
      let length = root - tip;
      let width = span / 71 * .69;
      let geo = geometryBuilders.merge([
        {
          geometry: geometryBuilders.box(width, .0011, length - .004),
          transform: mat4.translation(0, 0, -(length - .004) / 2)
        },
        {
          geometry: geometryBuilders.box(.00048, .0011, .004),
          transform: mat4.translation(0, 0, -length + .002)
        }
      ]);
      let matrix = mat4.translation(x, .05284, root);
      let node = renderer.add(geo, materials.steel, matrix, 'tooth');
      this.teeth.push({
        node,
        matrix,
        x,
        root,
        length,
        tip: [x, .05339, tip]
      });
    }
    for (let i = 0; i < 6; i++) {
      let x = -.061 + i * .0365;
      this.screw([x, .054, .050 - .004 * (i / 5)], .006, 'fixed', .3 + i * .47);
    }
  }
  buildControls() {
    const materials = this.materials;
    const renderer = this.renderer; // Engraved nameplate, start / stop lever, governor bridge and fly.
    this.box(.061, .0018, .018, [-.114, .034, .050], materials.edge, .0007);
    this.box(.059, .00025, .016, [-.114, .0351, .050], materials.label, .0004);
    this.box(.020, .013, .022, [-.122, .039, .018], materials.brass, .0015);
    this.box(.033, .002, .009, [-.121, .047, .018], materials.gold, .0006);
    this.screw([-.130, .0485, .018], .0024, 'fixed', .5);
    this.box(.006, .003, .031, [-.140, .047, .003], materials.black, .0015, 'fixed', -.19);
    this.part(geometryBuilders.cylinder(.0047, .002, 28), materials.gold, mat4.translation(-.143, .049, .017));
    this.screw([-.143, .050, .017], .0017, 'fixed', 1);
    this.box(.031, .002, .004, [-.097, .042, .021], materials.steel, .0004);
    this.part(geometryBuilders.cylinder(.0015, .041, 16), materials.steel, mat4.multiply(mat4.translation(-.109, .049, .017), mat4.rotationZ(Math.PI / 2)));
  }
  flushStaticParts() {
    const materials = this.materials;
    const renderer = this.renderer;
    for (let p of this.staticParts.values()) {
      let node = renderer.add(geometryBuilders.merge(p.items), p.mat, mat4.identity(), p.tag);
      if (p.tag === 'case') {
        this.caseParts.push(node);
      }
    }
    this.staticParts.clear();
  }
  buildGears() {
    const materials = this.materials;
    const renderer = this.renderer;
    const makeGear = (at, r, h, teeth, axis, ratio) => {
      let local = axis === 'X' ? mat4.rotationZ(Math.PI / 2) : mat4.identity();
      let meshGeometry = geometryBuilders.merge([
        { geometry: geometryBuilders.gear(r, h, teeth), transform: local },
        { geometry: geometryBuilders.cylinder(r * .25, h * 2, 24), transform: local }
      ]);
      let node = renderer.add(meshGeometry, materials.brass, mat4.translation(...at), 'gear');
      this.gears.push({
        node,
        at,
        axis,
        ratio
      });
    };
    makeGear([-.0815, .064, -.034], .024, .002, 60, 'X', 1);
    makeGear([-.084, .046, -.004], .012, .0025, 30, 'X', -2);
    makeGear([-.105, .043, .016], .008, .002, 20, 'Y', 6);
    makeGear([-.121, .046, .017], .005, .0018, 12, 'Y', -10);
    let fly = geometryBuilders.merge([
      { geometry: geometryBuilders.box(.018, .0005, .004, .0002), transform: mat4.identity() },
      { geometry: geometryBuilders.box(.004, .0005, .018, .0002), transform: mat4.identity() },
      { geometry: geometryBuilders.cylinder(.0014, .008, 16), transform: mat4.identity() }
    ]);
    let f = renderer.add(fly, materials.gold, mat4.translation(-.121, .055, .017), 'fly');
    this.gears.push({
      node: f,
      at: [-.121, .055, .017],
      axis: 'Y',
      ratio: 145
    });
  }
  buildWindingKey() {
    const materials = this.materials;
    const renderer = this.renderer; // Winding key on the left side, with an actual rotating bow.
    this.windBase = mat4.multiply(mat4.translation(-.173, .035, .018), mat4.rotationZ(Math.PI / 2));
    let key = geometryBuilders.merge([
      { geometry: geometryBuilders.cylinder(.0022, .032, 20), transform: mat4.identity() },
      { geometry: geometryBuilders.torus(.008, .0016, 32, 8), transform: mat4.translation(0, .017, 0) }
    ]);
    this.windNode = renderer.add(key, materials.gold, this.windBase, 'wind');
  }
}
