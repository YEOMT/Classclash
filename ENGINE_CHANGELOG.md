# Class Clash 0.2 engine changes

Baseline: local `70987cb7181e8f5eda29735927efcf96c997a24e`. The user's later explicit choice retains the LOL three-lane map, TOP/MID/BOTTOM/JUNGLE deployment, 18 structures, 42 opening minions, and six camps. The cancelled two-lane work was archived separately. This change does not replace champion art, skill definitions, quiz/economy rules, or manual deployment.

## Targeting and formation

- Targets have a 16-tick minimum hold and a 12-point switch margin. A legal low-HP nexus can override the hold. Chases are bounded by elapsed commitment and distance from the engagement point.
- Target-score calculations are cached within each evaluation. Melee crowd counts use the existing tick-start reservation snapshot, reducing repeated whole-army scans and intent-order dependence. Neutral monsters may have attackers from both teams, so this is an intentional crowd-policy change, not a claim of bit-identical old decisions.
- Melee slots depend on actual circumference and attacker radius (6–32 slots), reserve physical positions, expire after 16 ticks, and release on target changes. A full ring temporarily rejects that target so another legal target can be evaluated.
- The local frontline is the median of healthy melee/tank units. An isolated assassin and allies below 30% HP do not drag the whole backline forward. Retreat points must be on legal ground, reachable, and must not newly enter enemy tower range. A blocked retreat leaves normal attacks available.
- Low-HP legal structures receive a finishing preference. Existing tower dependency, escort, aggro and skill semantics remain intact. A destroyed nexus remains the only victory trigger; no time-limit winner was introduced.

## Movement and diagnostics

- Progress is movement toward a committed waypoint, rather than any sideways displacement. At 24 stalled ticks the unit searches legal local escape points; at 48 it releases and temporarily rejects an unreachable target; at 100 it records a full stall. Diagnostics retain the location, goal and reason.
- Fixed a reproducible sub-pixel gap between rounded road capsules. The old six-pixel line sampler accepted a direct route which three-pixel movement could never follow. Continuous capsule-interval coverage now checks the entire segment, with the same collision contract for A*, path smoothing and real movement. The exact archer fixture formerly remained at `(265.560351,354.585759)` for 300 ticks; it now advances beyond y=500 within 100 ticks without teleporting.
- A subsequent 40-seed attempt exposed a numerical boundary regression: tiny crowd corrections could cross the exact terrain endpoint by about one millionth of a pixel, then remain invalid for thousands of ticks. Seed 1021 first reproduced this at battle second 25.65. Exact `inLane` endpoint checks and strict structure clearance now supplement interval coverage. A 200-correction regression checks the actual coordinates.
- `laneProgress` caches geometry results by object identity and current x/y, invalidating on movement. Hero state/target/reason changes retain a bounded 256-entry decision trace. It contains no quiz answers or session credentials.
- Room projection accepts optional `includeBattle=false`; the default is unchanged. This permits one public battle projection per broadcast while retaining separate private player projections.

## Verification and evidence boundaries

- `artifacts/v02-engine-final2-regression.log`: 95/95 actual tests passed (combat, map, jungle, 36 real AI skill activations, fixed scenarios).
- `artifacts/v02-engine-scenarios-complete.log`: 26/26 expanded fixed scenarios passed, including actual minions in the mixed fight, small-target melee pressure, tower aggro transitions, multi-caster CC/cleanse, shared-base combat, distinct silence behavior and simultaneous lethal nexus projectiles. Long scenarios collect events throughout execution rather than reading only the final 10-second event window.
- `artifacts/v02-engine-additional-regression.log`: 32/32 passed (the earlier20-scenario version plus12 progression/quiz/AI parity cases). Counts overlap with other runs and must not be summed as unique tests.
- `artifacts/v02-engine-art-lab.log`: 2/2 actual art-combat fixtures passed; the dense case starts30 ordinary heroes and168 minions and preserves valid geometry for600ticks.
- `artifacts/v02-final-results.json`: interrupted first 40-seed attempt, 2 completed / 40 requested, 12,547 invalid-position observations. This is **FAIL**, not a completed sample. Source hashes were unchanged during that run.
- `artifacts/v02/invalid-1021.json`: exact first invalid unit, prior state and recent events.
- `artifacts/v02-final2-results.json`: corrected 40-seed run completed with **FAIL** for outcome targets:38 nexus results,2 unfinished at900seconds(seeds1031/1035),9/40 in600–780seconds. Invalid positions=0, negative balances=0, duplicate active heroes=0,12 full-stall diagnostics. Completed-match median519.025seconds; the median across all40 ordered outcomes is527.375seconds (both right-censored unfinished matches rank above it). Source hashes remained unchanged. Tick durations from concurrent workers are not a live server performance benchmark.
- `tests/v02-engine-scenarios.test.ts` includes commitment, multi-melee contact, ranged release, mixed roles, forbidden wall-crossing leap, effective healing, minion-escorted siege, open-lane nexus finish, crowded spawn, root, and two exact boundary regressions. Existing combat and skill tests cover projectile survival, simultaneous lethal impacts, CC caps, cleanse, and distinct status cancellation.

Individual acceptance rows are mapped conservatively in `artifacts/v02/engine-acceptance.json`; unasserted visual behavior and unexecuted combinations are not marked PASS. Full-match and performance evidence is reported separately by the integration runner.

`artifacts/v02/engine-scenarios.json` maps SC01–SC16 to exact seeds/steps/assertions. `artifacts/v02/population-mirror-results.json` separately records5/10/20-player matches and one30-player swapped-team pair. The5/10-player runs were still active at900seconds;20players finished551.35seconds. The pair finished366.6/452.15seconds and both were won by sideA, meaning different participant groups won. One pair is an observed asymmetry, not statistical proof of fairness or bias. All five runs retained valid geometry and unchanged source hashes.

Three additional four-seed balance candidates ran in isolated process memory without changing engine files. None met the three-of-four target-window gate. The split lane/base durability candidate completed all four but had only two target-length results and did not retest the known unfinished seeds1031/1035. It was not adopted. Final runtime remains the actually measured7500/10000structure table and existing health phases; full40-seed pacing is explicitly **FAIL**. See `BALANCE_CHANGELOG.md` for exact candidate tables, evidence and reproduction commands. All owned simulation processes were stopped before the separate live performance window.
