/** Duration of the entire indexed programme, in seconds at nominal speed. */
export function getCylinderDuration(spec) {
  return spec.duration * (spec.turns ?? 1);
}

/** Select the axial track, retaining the final track when a programme ends. */
export function getCylinderTurn(spec, position) {
  return Math.min((spec.turns ?? 1) - 1, Math.max(0, Math.floor(position / spec.duration)));
}

/** Absolute programme time of a pin; its local time still specifies its angle. */
export function getNoteTime(note, spec) {
  return (note.turn ?? 0) * spec.duration + note.time;
}
