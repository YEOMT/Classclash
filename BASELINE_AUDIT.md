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

## Build safety inspection

Current scripts/build-sprites.mjs is a read-only validator for asset-motion-01 and world assets. Unlike the older remote generator it does not regenerate PNGs. scripts/validate-rework-assets.mjs checks original champion and map hashes. package build/pretest invoke these validators. Independent legacy generators exist and must stay opt-in. The new pipeline will hash source assets before/after build and use approved-source manifests. No baseline build executed until backup completed.

## User-confirmed baseline and rules

The user explicitly corrected the baseline on 2026-10-28: this chat’s LOL map, 18 champion animations, TOP/MID/BOTTOM/JUNGLE and friendly-jungle-first logic are authoritative. In the follow-up choice the user confirmed "최신 LOL 3라인+정글 유지". This supersedes the attached two-lane clause and 2-lane acceptance geometry. Preserve 18 structures (6 lane towers+2 guards+nexus per team), 42 initial minions and 6 jungle camps. Other economy/quiz/manual-deployment rules remain. The cancelled 2-lane attempt is archived in Class_Clash_Cancelled_TwoLane_20261028.zip; only its known source changes were restored byte-for-byte from 70987cb. Independent production security work may be reused after review.

## Baseline verification

Pending current build/test/browser reproduction; previous report is historical evidence only.
