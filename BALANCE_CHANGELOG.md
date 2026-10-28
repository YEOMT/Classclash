# Class Clash 0.2 balance changes

The retained runtime baseline is local `70987cb`, including the user-confirmed LOL three-lane map and jungle. Only symmetric structure durability changed in this iteration. No hero, quiz reward, wallet, gacha, minion count, or bot-only resource multiplier changed.

| Structure | Previous runtime HP | 0.2 HP |
| --- | ---: | ---: |
| Outer tower | 4,500 | 7,500 |
| Inner tower | 6,000 | 10,000 |
| Guardian tower | 4,500 | 7,500 |
| Nexus | 6,000 | 10,000 |

Damage, armor, range, attack cadence and radius remain unchanged. Both teams and human/AI matches use the same table in `src/shared/balance.ts`.

The 20-second minimum dead preparation delay, 35-second waves, three melee plus four ranged minions per lane, existing late minion HP/power/siege phases and jungle recovery are preserved from the latest local version. After the delay, only the existing deployment command starts a new life. Quiz and progression remain server-authoritative.

## Candidate evidence

Before the continuous corridor fix, the first two engine candidates ended at 668.4 and 385.4 seconds with 10 and 6 recorded stalls. These measurements combine engine changes and cannot isolate the HP effect.

With the same continuous corridor fix, symmetric HP ×1.667 candidates ended at 737.55 and 470.4 seconds (seeds 1001/1002; 0/1 stalls, no invalid positions). HP ×3 candidates produced one unfinished match at the 900-second observation cap and one 709.5-second result (0 stalls/invalid in both). The ×1.667 table was retained because both observed matches completed. These two seeds alone do **not** establish the requested 10–13 minute distribution.

Candidate files: `artifacts/v02/structure-study-1001-1.66666666666667.json`, the matching 1002 file, and `structure-study-1001-3.json` / `structure-study-1002-3.json`.

The first attempted 40-seed run is preserved as `artifacts/v02-final-results.json` (FAIL, interrupted after 2 records due to a real numerical collision regression). The corrected run is `artifacts/v02-final2-results.json`. Its actual completed count, median, range, 600–780-second proportion, unfinished seeds and collision diagnostics determine the final result. No target-length PASS is implied before that evidence exists.

The runner's 900-second observation cap stops the test, not the game. It never compares nexus HP or declares a winner when time expires. Concurrent simulation timings are excluded from the separate 1× live-server performance claim.

## Corrected engine outcome and further candidates

The corrected7500/10000 runtime completed38/40matches, with2 still playing at900seconds, and only9/40 inside600–780seconds. Completed-match median519.025seconds; all40 ranked outcomes give median527.375seconds because the two censored results are both above900seconds. Outcomes were A30/B8,2 unfinished. All40 had zero invalid positions, negative balances and duplicate active heroes. The timing/distribution criterion therefore **FAILS** despite the collision fix.

Further comparisons use `scripts/balance-candidate.ts`, changing only the candidate process's in-memory table. They do not modify runtime files, resource awards, team-specific stats, attack rules or the nexus-only victory condition. The script records source hashes, original/candidate tables and each full result.

| Candidate | Seeds1001/1002/1003/1021, seconds | Completed | In600–780 | Decision |
| --- | --- | ---: | ---: | --- |
| All structures13500/18000, existing minionHP phases | >900 /684.2 /717.5 />900 |2/4|2/4|Rejected |
| Same structures, minionHP phases1/2/3/4 at0/480/600/720sec | >900 /722.2 /612.6 /868.3 |3/4|2/4|Rejected |
| OUTER13500 / INNER18000 / GUARD4500 / NEXUS6000, minionHP1/2/3/4 |769.15 /530.85 /520.5 /696.55|4/4|2/4|Not adopted |

Evidence: `artifacts/v02/current-engine-hp13500.json` and `current-engine-hp13500-health234.json`. Both retained source hashes and zero invalid positions. Reducing late wave durability improved one unfinished seed, but did not resolve the excessive shared-guardian siege time. In seed1001 of the second candidate, the first outer/inner/guardian fell at287.4/516.4/674.1seconds, yet neither nexus had taken damage by900seconds.

The split candidate separates early lane pacing from the much shorter defender reinforcement distance in the base. `artifacts/v02/current-engine-split-hp-health234.json` records4/4completed, zero invalid positions, one full-stall diagnostic and unchanged source hashes. However, only2/4finished inside the target window, below the proposed3/4candidate gate. It also did not test whether the known unfinished seeds1031/1035 improve, and it has no40-seed distribution. Therefore it was **not adopted** merely on the basis of four completions.

**Final runtime decision:** retain OUTER/GUARD7500 and INNER/NEXUS10000, with the existing minion health phases1/3/8/12. This is the table actually measured across40seeds. Report38/40completed,9/40target-length and2unfinished as **FAIL**, preserving every seed and every rejected candidate. No later unmeasured table replaces these numbers, and no time-based victory or direct nexus damage is introduced. The remaining pacing, late siege and side-asymmetry findings require further balance work; functional implementation is not a claim that those acceptance targets passed.

Reproduction examples:

```powershell
node --import tsx scripts/balance-candidate.ts current-engine-hp13500 13500 18000 1001,1002,1003,1021
node --import tsx scripts/balance-candidate.ts current-engine-hp13500-health234 13500 18000 1001,1002,1003,1021 234
node --import tsx scripts/balance-candidate.ts current-engine-split-hp-health234 13500 18000 1001,1002,1003,1021 234 4500 6000
```

Each command exits nonzero when its explicit completion/window/integrity gate fails. Preserve the recorded JSON before reusing a label, because the runner writes that label's evidence file.
