# Architecture and maintenance notes

## Dependency direction

```text
main.js
  → MusicBoxApp
      → UI views / control bindings / file actions
      → Transport → SoundEngine → deterministic tine synthesis
      → MusicBoxScene → model builder + camera controller
                       → ThreeRenderer → Three.js + GLSL

UI / file tools / scene
  → cylinder contract, validation, geometry interpretation and generation
      → pure geometry builders and coordinate math
```

The cylinder/geometry/math modules have no DOM, audio context, WebGL context or
Three.js dependency. That is intentional: the same interpretation and export logic
runs in browser file handling, the command-line tools and the Node regression suite.
`toBufferGeometry()` is the explicit conversion boundary to the GPU-side scene.

`MusicBoxApp` owns a session: the selected library entry, busy state, the composition
of services, and user-level actions. Views display state; they do not invent their
own playback clock. The app receives a scene factory so controller/audio behavior
can be exercised without pretending a rendering test double is a real Three.js render.

## Rendering and the model

`ThreeRenderer` creates the real Three.js scene, cameras and GPU resources. Each
`ScenePart` owns an actual `THREE.Mesh`, geometry and material. It exposes `matrix`,
`visible` and `emission` for the animation layer and releases its resources when
removed. Scene parts are not a second rendering engine.

`MusicBoxBuilder` separates construction into the base, open lid, spring barrel,
cylinder bearings, comb, controls, gears and winding key. Static pieces with the same
material/tag are merged to retain the original draw grouping. Teeth remain individual
meshes so they can vibrate and highlight independently. The removable rotor is owned
by `MusicBoxScene`; changing cylinders releases its old GPU buffers/materials.

The materials deliberately use `RawShaderMaterial`, not `MeshStandardMaterial`.
The old look includes custom studio reflections, scratches, direct lighting, a filmic
curve and gamma-2.2 conversion. Switching shading models is an aesthetic change,
not a neutral cleanup. Textures are tagged `NoColorSpace` because this shader applies
its own decoding. The final shader also owns the output curve; avoid adding a second
tone-mapping or color-encoding pass.

Shadows use a depth-texture render target and an orthographic camera. The surface
shader applies the original comparison-sampler 3×3 filter. The floor receives shadows
but does not cast them. `shadowDirty` schedules updates when moving mechanisms,
cylinder swaps, case visibility or explicit seeking require a new depth map.

The CPU matrix helpers keep the original Float32 operation order for procedural
geometry and file-coordinate transformations. Three.js still owns the live scene and
camera matrices. Do not replace those helpers wholesale without rerunning the
geometry/GLB baselines: small changes can alter exported coordinates.

## Playback and mechanical motion

`Transport` is the only clock. It schedules ahead against `AudioContext.currentTime`,
not against frame count. The look-ahead queue also carries visual strike events;
the frame loop releases a tooth highlight/vibration when its audio event is due.

A generation token invalidates an asynchronous audio unlock when pause, seek or a
cylinder swap intervenes. Pause fades voices and clears scheduled visual events.
End-of-turn stops the scheduler without chopping off naturally decaying notes.

`MusicBoxScene.update()` observes the transport position to rotate the cylinder and
gears. It animates the lift, winding key and comb teeth, then asks the renderer to
render. It does not independently advance musical time or synthesize sound.

`SoundEngine` owns live audio nodes, sample caching, voice lifetime, panning, filtering,
compression and convolution. `tineSynthesis` is pure and deterministic. `wavExport`
builds a separate offline audio graph: the original dry export does not use the live
volume/resonance settings.

## Cylinders and interchange

`validateCylinder()` produces the single normalized score shape used everywhere.
The JSDoc `CylinderSpec` and `CylinderNote` definitions are in `src/cylinder/types.js`.
Times are seconds into one revolution. Tuning is a 72-element MIDI table; `tooth`
is a lane index, not a pitch.

GLB import has three steps:

1. `decodeGLB` / `decodeGLTF` obtains embedded buffers and JSON without network fetches.
2. `parseGLTFGeometry` reads the supported accessor subset and flattens node transforms.
3. `interpretCylinderGLTF` finds the body, aligns it, detects radial pins and decodes
   their positions. Named pin meshes are preferred, then small separate meshes, then
   connected radial-tip clusters in a merged mesh.

Metadata provides the coordinate convention, tuning and seconds per turn; it does
not contain a hidden note-time array. Moving a mesh really changes the inferred score.
The standalone exporter deliberately keeps its canonical output bytes unchanged,
so existing cylinders and external-editor workflows remain compatible.

Changing revolution duration scales all event times proportionally. The ratio
`time / duration`, and therefore every pin's angle, stays unchanged. Changing the
editor grid resolution only changes placement snapping, not existing notes.

## UI responsibilities

`PlayerView` owns readouts and the playback button presentation. `LibraryView` owns
cards/thumbnails and aborts old listeners when rebuilding. `WorkshopController`
keeps a draft score isolated until Apply. Separate drawing functions render the
2D timeline, thumbnails and workshop without mutating musical state.

The three `bind*Controls` modules group player, view and file interactions.
`Notifications.guard` is the asynchronous event error boundary. `EventScope` uses
one abort signal for owned listeners. `Downloads` owns object URLs and their cleanup.
User-provided titles are inserted as text, not HTML.

The CSS is split by contiguous sections of the original stylesheet. Its original
184 top-level rules remain in the same order. Responsive overrides must stay last.
Do not alphabetize these imports or selectors as a cleanup step.

## Lifecycle

`MusicBoxApp.dispose()` cancels animation, aborts UI listeners, releases download URLs,
stops transport timers/voices, closes audio, disposes the Three.js resources and
removes its debug reference. The camera controller separately aborts pointer listeners.
Vite hot reload disposes the old app before creating another one.

Hot reload is a fresh session, not state persistence. The library, workshop draft and
playhead are not serialized automatically. Export work before a restart.

## Making changes safely

Start with `npm test` and `npm run check`. A geometry or audio baseline failure may be
an intended change, but do not update a golden hash merely to make a test green.
Compare the old and new outputs first. The fixture README describes their provenance.

After installing dependencies, run `npm run build` and `npm run test:browser`, then
visually compare perspective, top and comb views against the original demo. Those
rendering/build checks were not possible during this archive's creation, so the
code/data baselines must not be treated as proof of pixel-identical rendering.
