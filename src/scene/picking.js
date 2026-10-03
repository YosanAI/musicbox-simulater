/** CSS-pixel distance to any point along a projected comb tine. */
export function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const squareLength = dx * dx + dy * dy;
  const fraction = squareLength ? Math.max(0, Math.min(1,
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / squareLength)) : 0;
  return Math.hypot(point[0] - start[0] - fraction * dx,
    point[1] - start[1] - fraction * dy);
}
