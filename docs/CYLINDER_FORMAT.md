# Playable cylinder contract — v1

## The essential rule

The geometric score has two coordinates: **position along the cylinder selects a tooth**; **angle around it selects an event time**. The reader does not obtain note/time events from a hidden score in the GLB. It reads the transformed mesh geometry. Moving a pin one tooth lane changes the note; rotating a pin around the barrel changes when it sounds.

All values below are conventions of this simulator, not measurements of a factory Reuge cylinder.

## Canonical geometry

The cylinder is centered at the origin with its long axis along **X**. Distances are metres.

| Parameter | Value |
|---|---:|
| Body length | 0.214 |
| Body radius | 0.024 |
| First tooth center, X | -0.099 |
| Last tooth center, X | +0.099 |
| Number of teeth | 72 |
| Tooth pitch | 0.198 / 71 |
| Pin length | 0.0015 |
| Pin radius | 0.00023 |
| Radial pin-center distance | 0.02475 |
| Contact angle at the comb | 2.0 radians |

For zero-based tooth index `i`, note time `t`, and seconds per turn `T`:

```text
x     = -0.099 + i * 0.198 / 71
angle = 2.0 - 2*pi*t/T
center = [x, 0.02475*cos(angle), 0.02475*sin(angle)]
```

Each pin is a short radial mesh pointing outward. The exporter uses a pin mesh whose local long axis is Y, positioned at `center` and rotated about X by `angle`. The complete cylinder subsequently rotates by `+2*pi*elapsed/T` about X. At time `t`, the pin reaches the comb at angle 2.0. Pins sharing an angle form a chord; times are in the half-open interval `0 <= t < T`.

The canonical GLB has a `cylinder_body` object and separate `pin_00000`, `pin_00001`, ... objects. The reader uses the mean transformed vertex position of each named pin to recover its center. Symmetric straight pins work best. Very uneven tessellation, ornamented asymmetric pin meshes or sub-meshes can shift that estimate. Keep each named pin as one mesh primitive. An object's origin by itself is not the score: moving its vertices also changes the inferred note/time.

Default tooth `i` plays MIDI `36 + i` (C2–B7). MIDI 60 is middle C (C4). A full custom 72-element `tuning` array can contain another mapping, including duplicates. With duplicate tuning notes, specify `tooth` rather than MIDI when authoring JSON to choose a particular lane. Geometry must land within 0.38 tooth pitches of a lane center; otherwise the import reports the alignment problem.

## GLB metadata

The root node `MusicCylinder` has the following glTF `extras`:

```json
{
  "musicBox": {
    "schema": "crescendo-cylinder/v1",
    "title": "My cylinder",
    "composer": "Your name",
    "secondsPerTurn": 30,
    "axis": "X",
    "units": "metres",
    "length": 0.214,
    "radius": 0.024,
    "minX": -0.099,
    "maxX": 0.099,
    "pinLength": 0.0015,
    "pinRadius": 0.00023,
    "contactAngle": 2.0
  }
}
```

Add `tuning` inside `musicBox` to override the default, as an array of exactly 72 integer MIDI values in 0–127. The exporter includes that array. Optional `extras.velocity` on an individual pin is a number greater than zero and at most one; default is 0.75. Velocity is a synthesis control, not a calibrated consequence of pin size. **There is no note/time event array in the exported GLB metadata.**

Keep the canonical body centered with its X axis unchanged when retaining this metadata. A global transform baked into vertices without correspondingly updating metadata can invalidate the coordinate contract. For external editors, preserve glTF custom properties/extras and use a glTF export that restores glTF's coordinate frame. The safest round trip is an unmodified import/export test before making pin edits. Do not assume a 3D editor's displayed local axes are identical to the exported axes.

## Imports without metadata

An X-, Y- or Z-aligned barrel can be recognized, centered and rescaled. The longest barrel dimension determines its axis; a suitably named body is preferred. Teeth are assumed to occupy the standard span fraction, tuning defaults to C2–B7, the contact angle is assumed to be 2.0, and a turn takes 30 seconds until changed with **One revolution**. There is no way to infer the intended tuning table, starting phase or mechanical tempo uniquely from arbitrary geometry alone.

Named pins are the most reliable route. When names are absent, small separate meshes near the barrel surface are considered. For a merged mesh, the importer groups connected vertices protruding above the barrel into candidate tips. This fallback is heuristic, not a general-purpose recognition system. It works best with isolated, clean radial pins and a smooth barrel. Fused/bridged pins, decorative radial details, a body displaced under canonical metadata, a skewed arbitrary-axis barrel, or a cylinder that encodes multiple indexed tunes may require reauthoring.

A plain cylinder with a bump/normal texture has no actual pin geometry and cannot be decoded. Compression extensions, external buffers and sparse accessors are unsupported. Plain embedded glTF or GLB triangle meshes are recommended. The importer supports node hierarchies and ordinary node transforms, but does not import animations or custom texture maps.

## JSON authoring

JSON is a convenient score-to-geometry path. Save the following as `my-cylinder.json`, load it into the simulator, then export GLB:

```json
{
  "format": "crescendo-cylinder",
  "version": 1,
  "title": "My first cylinder",
  "composer": "Your name",
  "duration": 8,
  "notes": [
    {"time": 0,   "midi": 60, "velocity": 0.75},
    {"time": 0.5, "midi": 64, "velocity": 0.7},
    {"time": 1,   "midi": 67, "velocity": 0.8},
    {"time": 2,   "midi": 72, "velocity": 0.7}
  ]
}
```

Use `tooth: 0` through `tooth: 71` instead of `midi` to address a lane directly. A chord is several notes with the same time. Duration must be 2–600 seconds, all times must be less than duration, and there can be at most 6,000 notes. Exact duplicate tooth/time events are deduplicated. There is no note-duration field: a pin plucks, then the synthesized tooth decays naturally.

Changing **One revolution** in the interface rescales all times proportionally while preserving pin angles. The playback-speed slider changes elapsed time only and does not retune the notes.

## Programmatic export

```sh
node scripts/make-cylinder.js my-cylinder.json my-cylinder.glb
```

This helper loads the same validator and exporter as the app; it has no npm dependencies. Output is uncompressed GLB 2.0. GLB export rebuilds the canonical body and pins from the score; it does not preserve arbitrary decorative imported meshes. Use JSON export to preserve the interpreted events and custom tuning, and keep your original source model separately.

## Source locations in this project

`src/cylinder/constants.js` is the coordinate/tuning/limit contract.
`src/cylinder/pinGeometry.js` constructs the barrel and pins.
`src/cylinder/gltf/exportGLB.js` writes the canonical editable model.
`src/cylinder/gltf/interpretCylinder.js` recovers the score from physical geometry.
`src/io/cylinderFiles.js` handles the browser's local File objects.

Generate a GLB without starting a browser:

```bash
npm run cylinder -- public/samples/Four-note-test.json my-cylinder.glb
```

The JavaScript `getPinPosition()` helper returns `{ x, y, z, angle }`. This internal
API is more explicit than the old `a` field; it does not change the file format.
