import { DoubleSide, GLSL3, LessDepth, NoBlending, RawShaderMaterial, Vector3 } from 'three';
import vertexShader from './shaders/musicbox.vert.glsl?raw';
import fragmentShader from './shaders/musicbox.frag.glsl?raw';

/** Preserve the original lighting model rather than changing to a stock PBR look. */
export function createMusicBoxMaterial(parameters, shared) {
  return new RawShaderMaterial({
    name: parameters.name || 'Crescendo surface',
    glslVersion: GLSL3,
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    depthFunc: LessDepth,
    blending: NoBlending,
    toneMapped: false,
    uniforms: {
      uColor: { value: new Vector3().fromArray(parameters.color) },
      uMetal: { value: parameters.metal },
      uRough: { value: parameters.rough },
      uType: { value: parameters.type },
      uEmission: { value: new Vector3() },
      uTexture: { value: parameters.texture || shared.whiteTexture },
      uTextured: { value: Boolean(parameters.texture) },
      uEye: shared.eye,
      uLightMatrix: shared.lightMatrix,
      uShadow: shared.shadowTexture,
      uShadows: shared.shadowsEnabled,
      uShadowSize: shared.shadowSize,
    },
  });
}
