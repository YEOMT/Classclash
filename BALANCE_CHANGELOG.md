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
