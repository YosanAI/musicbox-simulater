# Regression baselines

These fixtures were derived from the original Crescendo demo before
comparing the refactored implementations.

`original-model.json` describes each of the 93 original non-rotor model parts in
creation order. Geometry hashes include Float32 position/normal/UV buffers and
Uint32 triangle indices. Transforms, material group names and shadow participation
are recorded separately. The recorder does not need a renderer or WebGL context.

`original-audio.json` stores lengths and SHA-256 hashes of five original Float32 PCM
buffers. The comparison used the actual original synthesis function, not a new
function to generate its own expected result.

The original demo `.glb` files in `tests/fixtures/cylinders/` are also byte-for-byte golden
fixtures. `legacyCylinders.js` retains their original one-revolution score generators,
independently of the current repertoire library. Tests regenerate those scores with
the exporter and compare the original files. Pin-move/rotation tests prove that imports decode physical
geometry rather than relying on a filename or hidden note array.

The previous six generated three-air GLBs and the small browser import examples
also live in that directory. They were moved unchanged when the active sample
library was replaced with the supplied six-cylinder pack. They are not menu entries.

These are source/data baselines, not screenshots or proof of Three.js visual parity.
Do not overwrite them casually after a failed test; document an intentional behavior
change and review its result before updating a baseline.
