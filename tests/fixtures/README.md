# Regression baselines

These fixtures were derived from the supplied original Crescendo demo before
comparing the refactored implementations.

`original-model.json` describes each of the 93 original non-rotor model parts in
creation order. Geometry hashes include Float32 position/normal/UV buffers and
Uint32 triangle indices. Transforms, material group names and shadow participation
are recorded separately. The recorder does not need a renderer or WebGL context.

`original-audio.json` stores lengths and SHA-256 hashes of five original Float32 PCM
buffers. The comparison used the actual original synthesis function, not a new
function to generate its own expected result.

The original demo `.glb` files in `public/samples/` are also byte-for-byte golden
fixtures. Tests regenerate the same three scores with the new exporter and compare
those files. Pin-move/rotation tests additionally prove that imports decode physical
geometry rather than relying on a filename or hidden note array.

These are source/data baselines, not screenshots or proof of Three.js visual parity.
Do not overwrite them casually after a failed test; document an intentional behavior
change and review its result before updating a baseline.
