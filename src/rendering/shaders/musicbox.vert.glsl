precision highp float;

in vec3 position;
in vec3 normal;
in vec2 uv;

// Three.js supplies these per mesh / per camera, including RawShaderMaterial.
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 uLightMatrix;

out vec3 vWorldPosition;
out vec3 vWorldNormal;
out vec2 vUv;
out vec4 vLightPosition;

void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vWorldNormal = mat3(transpose(inverse(modelMatrix))) * normal;
  vUv = uv;
  vLightPosition = uLightMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}
