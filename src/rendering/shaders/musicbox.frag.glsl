precision highp float;
precision highp sampler2DShadow;

in vec3 vWorldPosition;
in vec3 vWorldNormal;
in vec2 vUv;
in vec4 vLightPosition;
out vec4 outColor;

uniform vec3 uColor;
uniform vec3 uEye;
uniform vec3 uEmission;
uniform float uMetal;
uniform float uRough;
uniform float uType;
uniform float uShadowSize;
uniform bool uTextured;
uniform bool uShadows;
uniform sampler2D uTexture;
uniform sampler2DShadow uShadow;

float hash(vec3 point) {
  return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

vec3 fresnel(float cosine, vec3 reflectance) {
  return reflectance + (1.0 - reflectance) * pow(clamp(1.0 - cosine, 0.0, 1.0), 5.0);
}

// Original GGX-like direct lighting. Keep its constants to preserve the brass.
vec3 lighting(
  vec3 normal, vec3 view, vec3 light, vec3 radiance,
  vec3 albedo, float roughness, vec3 reflectance
) {
  vec3 halfVector = normalize(light + view);
  float nl = max(dot(normal, light), 0.0);
  float nv = max(dot(normal, view), 0.001);
  float nh = max(dot(normal, halfVector), 0.0);
  float hv = max(dot(halfVector, view), 0.0);
  float alpha = roughness * roughness;
  float alphaSquared = alpha * alpha;
  float distribution = alphaSquared /
    (3.14159 * pow(nh * nh * (alphaSquared - 1.0) + 1.0, 2.0) + 0.00001);
  float k = pow(roughness + 1.0, 2.0) / 8.0;
  float geometry = nv / (nv * (1.0 - k) + k) * nl / (nl * (1.0 - k) + k);
  vec3 f = fresnel(hv, reflectance);
  return (
    (1.0 - f) * (1.0 - uMetal) * albedo / 3.14159 +
    distribution * geometry * f / max(4.0 * nv * nl, 0.001)
  ) * radiance * nl;
}

// Procedural studio reflections: no downloaded HDRI or changed environment.
vec3 environment(vec3 reflection, float roughness) {
  vec3 sky = mix(
    vec3(0.035, 0.026, 0.018), vec3(0.43, 0.47, 0.53),
    smoothstep(-0.4, 1.0, reflection.y)
  );
  float a = max(dot(reflection, normalize(vec3(-0.55, 0.75, 0.28))), 0.0);
  float b = max(dot(reflection, normalize(vec3(0.7, 0.35, -0.5))), 0.0);
  sky += vec3(3.5, 3.15, 2.65) * pow(a, mix(95.0, 6.0, roughness));
  sky += vec3(1.8, 1.98, 2.2) * pow(b, mix(150.0, 12.0, roughness));
  float strip = smoothstep(
    0.965 - roughness * 0.22, 0.999 - roughness * 0.08, abs(reflection.z)
  ) * smoothstep(-0.2, 0.2, reflection.y);
  return sky + vec3(1.7) * strip;
}

void main() {
  vec3 normal = normalize(vWorldNormal);
  if (!gl_FrontFacing) normal = -normal;
  vec3 view = normalize(uEye - vWorldPosition);
  vec3 albedo = uColor;
  float roughness = uRough;

  // Textures are deliberately NoColorSpace: this shader owns the original gamma.
  if (uTextured) albedo *= pow(texture(uTexture, vUv).rgb, vec3(2.2));
  if (uType > 1.5 && uType < 3.5) {
    float scratches = hash(vec3(
      floor(vWorldPosition.x * 19000.0),
      floor(vWorldPosition.y * 350.0),
      floor(vWorldPosition.z * 380.0)
    ));
    roughness = clamp(roughness + scratches * 0.07, 0.09, 0.95);
    albedo *= 0.95 + 0.05 * scratches;
  }

  vec3 reflectance = mix(vec3(0.04), albedo, uMetal);
  vec3 light = normalize(vec3(-0.5, 0.85, 0.4));
  float shadow = 1.0;
  vec3 shadowCoord = vLightPosition.xyz / vLightPosition.w * 0.5 + 0.5;

  // The same 3x3 comparison filter and bias as the original renderer.
  if (uShadows && shadowCoord.x > 0.0 && shadowCoord.x < 1.0 &&
      shadowCoord.y > 0.0 && shadowCoord.y < 1.0 && shadowCoord.z < 1.0) {
    shadow = 0.0;
    float bias = 0.00045 + 0.0012 * (1.0 - max(dot(normal, light), 0.0));
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        shadow += texture(uShadow, vec3(
          shadowCoord.xy + vec2(x, y) / uShadowSize, shadowCoord.z - bias
        ));
      }
    }
    shadow /= 9.0;
  }

  vec3 color = lighting(normal, view, light, vec3(3.5, 3.15, 2.8),
    albedo, roughness, reflectance) * (0.18 + 0.82 * shadow);
  color += lighting(normal, view, normalize(vec3(0.7, 0.4, -0.5)),
    vec3(0.8, 0.9, 1.15), albedo, roughness, reflectance);
  color += albedo * (1.0 - uMetal) * (0.14 + 0.17 * max(normal.y, 0.0));
  color += environment(reflect(-view, normal), roughness) *
    fresnel(max(dot(normal, view), 0.0), reflectance) *
    (0.5 + 0.5 * shadow) * (1.0 - roughness * 0.42);
  color += uEmission;

  if (uType > 3.5) {
    float spot = exp(-5.0 * dot(vWorldPosition.xz, vWorldPosition.xz));
    color = vec3(0.010, 0.011, 0.013) +
      vec3(0.009, 0.010, 0.012) * spot * (0.35 + 0.65 * shadow);
  }

  // Original filmic curve and gamma. Do not apply a second Three.js output pass.
  color = (color * (2.51 * color + 0.03)) /
    (color * (2.43 * color + 0.59) + 0.14);
  outColor = vec4(pow(clamp(color, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}
