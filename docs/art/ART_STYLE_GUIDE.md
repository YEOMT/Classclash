# Class Clash 0.2 native artwork integration

The final user correction selects this chat's LOL 3-lane/jungle rework (70987cb), not the earlier two-lane TFM2 hero palette. All 18 supplied champion sheets, native JSON clips, LOL map and retained minion/structure/VFX sources are preserved byte for byte. No original is silently regenerated during build.

## Pipeline

- Immutable original inventory: assets/art-source/source-lock.json. The school-use scope is recorded; this is not a redistribution license.
- node scripts/pack-art.mjs reads originals and writes the identical contracts public/assets/v2/manifest.json and src/generated/art-manifest.json. The source copy supports Vite development without importing a public file as code.
- node scripts/validate-art.mjs verifies hashes, all native clips, variable frame rectangles, pivot/socket metadata and release markers.
- node scripts/test-art-preservation.mjs runs a full build between two source hash checks.
- node scripts/validate-art.mjs --release rejects the current non-redistributable bundle. Local build remains available.
- Legacy generators remain opt-in and are not invoked by ordinary build/pretest.

## Rendering decisions

Nearest texture sampling, shared PNG texture sources and per-renderer frame views are retained. Frame counts and source rectangles come from each native clip. No fixed 288/64 assumptions are used by the active champion renderer. Animation binding follows authoritative start/impact/recovery times; multi-hit poses change at server hit indices. Mirroring retains its previous side near a vertical heading, preventing small heading changes from flipping the character.

The native sources contain side-oriented drawings. Eight independent front/back/diagonal views were not created. The body pivot uses the preserved bottom-center convention; per-frame sockets are normalized visual anchors and explicitly marked for further hand/weapon review. They do not alter combat position, hitbox, range or damage.

Persistent zone boundaries follow the actual circle/rotated rectangle. Ground fields render below units; airborne shots and hit responses render above. The VFX pool has no default semantic-effect drop cap. Reduced quality changes resolution, not event visibility.

Minion source atlases include idle/walk/attack/death. A hit displays the original neutral frame plus a brief recoil/tint, with committed attacks retaining their release time. No extra gameplay stun is added; no dedicated new hurt sprite is claimed.

Audio cues distinguish metal, fist, arrow, flame, frost, healing and tower/magic, capped at six simultaneous voices. Student sound attenuates with distance and ducks while the quiz is open. Host camera remains fixed; student zoom is 1x/2x with clamped modest forward look.

## Verification boundary

Automated hashes and frame tests establish preservation and valid playback, not aesthetic approval. The /native-art-review.html gallery exposes every native clip. Actual server combat recordings are separate from this gallery. Newly added sockets, new viewpoints, and full 36-skill visual combinations have not been user approved.
