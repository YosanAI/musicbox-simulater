import {
  CanvasTexture, Color, DataTexture, DepthFormat, DepthTexture, DoubleSide,
  GLSL3, LessDepth, LessEqualCompare, LinearFilter, LinearMipmapLinearFilter,
  LinearSRGBColorSpace, Matrix4, Mesh, NoBlending, NoColorSpace, NoToneMapping,
  OrthographicCamera, PerspectiveCamera, RawShaderMaterial, RepeatWrapping,
  REVISION, RGBAFormat, Scene, UnsignedIntType, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { mat4 } from '../math/matrices.js';
import { toLinearColor } from './color.js';
import { toBufferGeometry } from './toBufferGeometry.js';
import { createMusicBoxMaterial } from './createMusicBoxMaterial.js';
import { ScenePart } from './ScenePart.js';
import depthVertexShader from './shaders/depth.vert.glsl?raw';
import depthFragmentShader from './shaders/depth.frag.glsl?raw';

/**
 * Three.js owns the context, scene graph, meshes, cameras, GPU resources and
 * draw calls. The original shader and explicit shadow pass preserve the demo's
 * appearance; replacing them with stock materials would change the brass/wood.
 */
export class ThreeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.backend = 'Three.js';
    this.revision = REVISION;
    this.nodes = [];
    this.textures = new Set();
    this.disposed = false;
    this.shadowDirty = true;
    this.shadows = true;
    this.shadowSize = 1024;
    this.drawCalls = 0;
    this.scene = new Scene();
    this.scene.name = 'Crescendo music box';
    this.camera = new PerspectiveCamera(36, 1, 0.005, 8);
    this.projectedPoint = new Vector3();
    this.webgl = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.webgl.sortObjects = false;
    this.webgl.toneMapping = NoToneMapping;
    this.webgl.outputColorSpace = LinearSRGBColorSpace;
    this.webgl.setClearColor(new Color().setRGB(0.058, 0.059, 0.063), 1);
    this.gl = this.webgl.getContext();
    this.webgl.debug.onShaderError = (gl, program, vertex, fragment) => {
      throw new Error([
        'The music-box shader could not compile.',
        gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment),
      ].filter(Boolean).join('\n'));
    };

    this.createShadowPass();
    this.shared = {
      eye: { value: new Vector3() },
      lightMatrix: { value: this.lightMatrix },
      shadowTexture: { value: this.shadowTarget.depthTexture },
      shadowsEnabled: { value: true },
      shadowSize: { value: this.shadowSize },
      whiteTexture: this.texture(new Uint8Array([255, 255, 255, 255]), 1, 1),
    };
  }

  createShadowPass() {
    this.shadowCamera = new OrthographicCamera(-0.29, 0.29, 0.30, -0.27, 0.01, 1.2);
    this.shadowCamera.position.set(-0.35, 0.62, 0.31);
    this.shadowCamera.lookAt(0, 0.025, 0);
    this.shadowCamera.updateMatrixWorld();
    this.lightMatrix = new Matrix4().multiplyMatrices(
      this.shadowCamera.projectionMatrix, this.shadowCamera.matrixWorldInverse,
    );

    const depthTexture = new DepthTexture(this.shadowSize, this.shadowSize, UnsignedIntType);
    depthTexture.format = DepthFormat;
    depthTexture.compareFunction = LessEqualCompare;
    depthTexture.minFilter = LinearFilter;
    depthTexture.magFilter = LinearFilter;
    this.shadowTarget = new WebGLRenderTarget(this.shadowSize, this.shadowSize, {
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture,
    });
    this.depthMaterial = new RawShaderMaterial({
      name: 'Crescendo shadow depth',
      glslVersion: GLSL3,
      vertexShader: depthVertexShader,
      fragmentShader: depthFragmentShader,
      side: DoubleSide,
      depthFunc: LessDepth,
      blending: NoBlending,
      colorWrite: false,
    });
  }

  texture(source, width, height) {
    const texture = width
      ? new DataTexture(source, width, height, RGBAFormat)
      : new CanvasTexture(source);
    texture.colorSpace = NoColorSpace;
    texture.flipY = true;
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.needsUpdate = true;
    this.textures.add(texture);
    return texture;
  }

  add(data, parameters = {}, transform = mat4.identity(), tag = '') {
    const materialParameters = {
      color: toLinearColor('#d0a54f'), metal: 0.85, rough: 0.28, type: 0,
      ...parameters,
    };
    const mesh = new Mesh(
      toBufferGeometry(data), createMusicBoxMaterial(materialParameters, this.shared),
    );
    mesh.name = tag || materialParameters.name || 'Music-box part';
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    const part = new ScenePart(mesh, materialParameters, transform, tag);
    this.scene.add(mesh);
    this.nodes.push(part);
    this.shadowDirty = true;
    return part;
  }

  remove(part) {
    const index = this.nodes.indexOf(part);
    if (index < 0) return;
    this.nodes.splice(index, 1);
    part.dispose();
    this.shadowDirty = true;
  }

  resize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.65);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      // Keep CSS dimensions unchanged and match the original rounded draw buffer.
      this.webgl.setSize(width, height, false);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  renderShadows() {
    const hidden = this.nodes.filter(part => part.visible && !part.cast);
    for (const part of hidden) part.visible = false;
    this.scene.overrideMaterial = this.depthMaterial;
    try {
      this.webgl.setRenderTarget(this.shadowTarget);
      this.webgl.render(this.scene, this.shadowCamera);
      this.shadowDirty = false;
    } finally {
      this.scene.overrideMaterial = null;
      this.webgl.setRenderTarget(null);
      for (const part of hidden) part.visible = true;
    }
  }

  render(eye, target) {
    if (this.disposed) return;
    this.resize();
    this.camera.position.fromArray(eye);
    this.camera.lookAt(...target);
    this.camera.updateMatrixWorld();
    this.shared.eye.value.fromArray(eye);
    this.shared.shadowsEnabled.value = this.shadows;
    if (this.shadows && this.shadowDirty) this.renderShadows();
    this.webgl.render(this.scene, this.camera);
    this.drawCalls = this.webgl.info.render.calls;
  }

  /** Project a world point to CSS pixels for tooth picking and mechanism labels. */
  project(point) {
    this.projectedPoint.fromArray(point).project(this.camera);
    return [
      (this.projectedPoint.x + 1) * 0.5 * this.canvas.clientWidth,
      (1 - this.projectedPoint.y) * 0.5 * this.canvas.clientHeight,
      this.projectedPoint.z,
    ];
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const part of [...this.nodes]) this.remove(part);
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
    this.shadowTarget.dispose();
    this.depthMaterial.dispose();
    this.webgl.dispose();
  }
}
