/**
 * A small procedural-assembly handle around a real THREE.Mesh.
 * It centralizes the transform/uniform bridge so the model builder does not
 * need to know which shader uniform animates a plucked tooth.
 * Access .mesh directly for Three.js tooling or additional scene work.
 */
export class ScenePart {
  constructor(mesh, parameters, transform, tag) {
    this.mesh = mesh;
    this.parameters = parameters;
    this.tag = tag;
    this.cast = true;
    this.matrix = transform;
  }

  get matrix() { return this._matrix; }
  set matrix(transform) {
    this._matrix = transform;
    this.mesh.matrix.fromArray(transform);
    this.mesh.matrixWorldNeedsUpdate = true;
  }

  get emission() { return this.mesh.material.uniforms.uEmission.value.toArray(); }
  set emission(value) { this.mesh.material.uniforms.uEmission.value.fromArray(value); }

  get visible() { return this.mesh.visible; }
  set visible(value) { this.mesh.visible = value; }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    // Shared procedural textures belong to ThreeRenderer, not this part.
  }
}
