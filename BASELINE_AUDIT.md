# Class Clash 0.2 baseline audit

Date: 2026-10-28 Asia/Seoul

- Workspace: C:\Users\jarsc\OneDrive\바탕 화면\코딩게임\클래스클래시
- Local branch: codex/positions-jungle-rework
- Local HEAD: 70987cb7181e8f5eda29735927efcf96c997a24e
- Remote main verified via GitHub: d060b535c49b63d219f851c431e0294e9dbcb157
- Latest local source is authoritative; no reset, clean or main overwrite performed.
- Backup: Class_Clash_Before_0.2_20261028.zip (2653 tracked/untracked nonignored files). Private databases, dependencies and .env are excluded. Existing original downloads are untouched.
- SHA-256 inventory: artifacts/v02/baseline/hashes.json (2013 source/runtime/client files).
- Full dirty status/worktree list: artifacts/v02/baseline/git.json. Modified older screenshots and untracked art reports/assets remain preserved.
- No AGENTS.md found in repository.

## Initial build safety inspection

At the initial audit, scripts/build-sprites.mjs was already a read-only validator for asset-motion-01 and world assets. Unlike the older remote generator it did not regenerate PNGs. scripts/validate-rework-assets.mjs checked original champion and map hashes. No baseline build was executed until backup completed. Independent legacy generators remain opt-in.

The completed0.2 build/pretest now run scripts/build.mjs: validate the approved source lock, pack derived manifests, build client/server and compare every original hash. The source lock covers365 files. Approved originals, including their line endings, are preserved by .gitattributes. A fresh Windows clone exposed automatic CRLF conversion; the failing clone/log were retained, and a new clone subsequently reproduced the exact bba2f9090927e34c8c670e0d8ccc681603f07d22accffbd160de4670485f9d09 manifest.

## User-confirmed baseline and rules

The user explicitly corrected the baseline on 2026-10-28: this chat’s LOL map, 18 champion animations, TOP/MID/BOTTOM/JUNGLE and friendly-jungle-first logic are authoritative. In the follow-up choice the user confirmed "최신 LOL 3라인+정글 유지". This supersedes the attached two-lane clause and 2-lane acceptance geometry. Preserve 18 structures (6 lane towers+2 guards+nexus per team), 42 initial minions and 6 jungle camps. Other economy/quiz/manual-deployment rules remain. The cancelled 2-lane attempt is archived in Class_Clash_Cancelled_TwoLane_20261028.zip; only its known source changes were restored byte-for-byte from 70987cb. Independent production security work may be reused after review.

## Baseline verification

The isolated pre0.2 copy reproduced185/185 passing tests: artifacts/v02/baseline/isolated-tests-final.log. Initial npm-path failures are preserved separately. Current runtime9f8601ec31ee1b84a670f52467855a2ca08da8a8 passes231/231 tests, typecheck and build; artifacts/v02/npm-test.log records the actual pretest invocation. Fresh install/build/identity and original-byte preservation are recorded in artifacts/v02/fresh-install.json.

## Publication boundary

The full implementation and selected artwork history remain on the local codex/class-clash-0.2 branch. A separate worktree, .tools/v02-public, starts at verified remote main d060b535c49b63d219f851c431e0294e9dbcb157 and copies authored source/configuration/metadata without new artwork pixels, recordings, original archives, databases or credentials. Its public branch is codex/class-clash-0.2-source; actual remote SHA and PR status are in artifacts/v02/publishing.json. No force push, hard reset, clean or main overwrite was used.
