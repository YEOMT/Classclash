# Native artwork visual review · 2026-10-28

## Selected baseline

Latest user correction: keep 70987cb's LOL map/champions. Earlier two-lane graphics-reference work was cancelled and archived by the parent task. Original PNGs are unchanged; there is no fabricated art redraw or claimed before/after quality jump.

## Executed automated checks

Native source/runtime hashes, all 18 clip bindings, exact authoritative first-hit timing, explicit three-hit skills, single-frame variable-count edge cases, socket/pivot bounds, facing deadband and seven sound families passed the focused tests (7/7). Attack periods at 0.5x/1x/2x preserve the release frame and cosmetic hurt never interrupts a committed attack. Separately the real combat art fixture runs on lanePath midpoint positions and preserves all six reference skills, motion, hit, projectile and death events. The initial stress failure was an engine boundary tolerance defect after tick 441, not initial placement. After the engine correction both fixture tests pass; 30 heroes plus 168 minions run 600 ticks with zero invalid positions (`artifacts/v02-engine-art-lab.log`).

## Visual evidence

Capture script: scripts/capture-v02-art.mjs. Output: artifacts/v02/art/. The script opens the real app, completes 20 quiz submissions, joins one human with 29 ordinary AI, and records the actual production UI/combat canvas at normal 1x scheduling. Gallery is a distinct page. Capture is not a performance benchmark.

The executed capture passes with zero page errors or asset errors. The host recording is 39.72 seconds and the student recording is 33.40 seconds, including page reconnect/loading around the 30-second observation interval. Both are 1280×800 VP9 recordings. Host presents 2,056 events and student presents 1,768; each reports zero semantic effect pool drops. Historical recovery events deliberately skipped by reconnect policy are recorded separately, not described as missing live attacks.

Capture identity is the health response in `capture-report.json`: base HEAD `70987cb7181e8f5eda29735927efcf96c997a24e`, working-tree candidate build time `2026-10-28T14:11:16.960Z`, asset manifest hash `bba2f9090927e34c8c670e0d8ccc681603f07d22accffbd160de4670485f9d09`. It is not a claim that the later final commit produced these earlier recordings. Subsequent Vite module-import, art-lab thumbnail and error-panel fixes were verified separately and leave original image bytes unchanged.

Inspected evidence:

- `01-all-native-champions.png`: all 18 native heroes are nonempty with distinct bodies/equipment; no older fallback hero is mixed in.
- `02-source-pipeline-comparison.png`: the same actual paladin, brawler, archer and pyromancer release-frame pixels appear above/below. This is source preservation, not a fabricated redraw comparison.
- `03-host-actual-combat.png` and host video frames at 10/25 seconds: the fixed full map shows live top/mid/bottom/jungle movement, health, projectiles and kills progressing. Dense groups still overlap names; all 36 skills are not exhausted by this short run.
- `03-student-actual-combat.png` and student video frame at 15 seconds: the human has died and sees maintenance while the shared battle continues. This recording does not establish live self-follow after redeployment. The reproducible script now includes a legal manual redeployment before its next student recording; that additional step was not part of this recorded run.
- `05-missing-asset-recovery.png`: an actual aborted required paladin PNG shows an actionable error/reload control and hides the unusable canvas. `05-native-art-lab-recovered.png` shows the same source restored, native thumbnails and actual fixture attacks/arrow area. Four host/student renderer recreations retain shared texture sources with no unexpected error.

The supplemental `artifacts/v02/art-acceptance.json` evaluates all 50 ART/ANIM/VFX/MAP rows: 13 PASS, 3 FAIL and 34 NOT_RUN for this scoped visual audit. Server scenarios can have separate engine evidence; NOT_RUN here does not replace those results. Explicit visual failures are eight independently authored views and exact per-frame hand/weapon/projectile sockets. Aesthetic review is not inferred from frame counts or file hashes.

The diagnostics browser run uses current Vite source. It exposed and fixed the unsupported public-manifest import in development and CSS overriding the canvas `hidden` attribute. The source module and public manifest are now verified identical. Two earlier diagnostics failures and three earlier capture failures remain saved beside the final PASS reports; they are not counted as successful runs.

## Limits retained honestly

- Original native drawings are left/right-oriented, not eight newly authored body views.
- Some source idle/hit/cast clips contain few frames or are shared between game skills; the 36 gameplay skills remain distinct in their server rules and effect shape.
- Per-frame sockets are normalized visual anchor metadata and need detailed weapon/hand review. The pipeline does not claim exact hand-authored sockets.
- The small Rammus-derived guardian_golem silhouette retains native frame padding.
- Minions use a neutral raster plus recoil/tint on hurt; there is no new standalone hurt clip.
- User scope is school educational local use without redistribution. Public asset distribution has not been authorized.
