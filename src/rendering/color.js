/** Original gamma-2.2 hex conversion, intentionally not THREE.Color's sRGB curve. */
export function toLinearColor(hex) {
  const value = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [value >> 16 & 255, value >> 8 & 255, value & 255]
    .map(channel => Math.pow(channel / 255, 2.2));
}
