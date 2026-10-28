# 현재 전장·챔피언 자산 (2026-10-27)

현재 게임은 사용자 첨부 LOL 맵과 18종 챔피언 원본 PNG/fanim을 사용합니다. [리워크 적용표](JUNGLE_REWORK.md), assets/source/jungle-rework/provenance.json, src/shared/champion-art.json을 확인하세요. 미니언·건물·효과는 기존 world-assets 출처를 유지합니다. 아래 문서는 이전 아트 제작 이력입니다.

---

# Classclash asset-based motion / 2026-10-27

## World raster update (after hero integration)

The current world renderer also loads `public/assets/world/`: four minion atlases, eight building PNGs, a 2048×768 background and 21 VFX clips (105 native frames packed into a 1024×1024 atlas). `src/client/world-art.ts` caches frame views and uses a reusable pool capped at 192 sprites. Every effect is driven by the existing server projectile, HIT, skill-impact or persistent-area clock. Range telegraphs and status HUD marks remain vector indicators.

Additional acquired source: https://github.com/PowerViber/tfm2_mods/tree/7b5ab117ab6ef3ae94a54f8180b971d028d7f67e (base-champion animation manifests/PNGs and `Claude outputs/map/art`). These are commercial TFM2 base pixels, not CC0. The previous explicit user authorization to use TFM assets applies; separate cross-game reuse terms remain unverified.

Dedicated original minion/tower/nexus sheets were not found in the inspected public repositories. The current **adaptations** reuse half-size knight/archer poses as soldiers, map monoliths as towers, and map altar/monolith pixels plus native magic FX as the nexus. They are not advertised as the original game's named minion or building sprites. `assets/source/world-assets/provenance.json` records source URLs, hashes, crop rectangles and palette changes. Ice/rune/lightning variants are documented recolors of source effect frames. No body or face is synthesized from drawing primitives.

Rebuild with `python scripts/build-world-assets.py` (Pillow and Node/tsx). The script reads the actual shared map definition, composes existing terrain crops through its walkable-area mask, and emits the same metadata used by runtime. Standard builds validate the checked-in assets. Gameplay changes explicitly requested in this subsequent step are 35-second waves of 2 melee + 3 ranged per team/lane, 192-unit lanes, and 50% structure HP. Earlier hero-integration preservation/performance evidence below describes that historical stage, not the current balance. Current evidence is in `artifacts/world-assets/`.

## Current source and provenance

The production set now uses 17 acquired TFM2 PNG sprite sheets and one approved CC0 stone-golem raster. These replace the previous code-authored anatomy. They are not presented as wholly original Classclash artwork or as an all-CC0 asset set.

- TFM2 source: https://github.com/hexase1-ship-it/TFM2.gg, commit `3e65bd7cf505ae6586be020869a8fcdebeb6990b`. Actual original PNGs are preserved in `assets/source/asset-static/originals/`.
- Official mod documentation inspected: https://github.com/teamsamoyed/TeamfightManager2Mod. Availability for modding is not treated as a general artwork redistribution license.
- The user explicitly authorized using these acquired assets after the missing cross-game reuse terms were explained. Asset reuse/redistribution terms remain unverified; the repository software license is not asserted to license its character graphics.
- Golem: Ragewortt/zwonky, https://opengameart.org/content/golems, CC0. Its approved raster body is articulated from cutout parts because the acquired source contains no motion sheet.

The exact per-hero source URL, source SHA-256, selected PNG regions and translations are in `assets/source/asset-motion/motion-catalog.json`. `assets/source/asset-static/provenance.json` retains the approved static-design provenance and protected face coordinates. Original source files and the static review were preserved.

## Artwork and build

`scripts/inspect-motion-sources.py` catalogs actual connected raster regions for visual review. `scripts/build-asset-motion.py` selects reviewed movement, attack, reaction, cast and death poses, applies the approved material palettes and raster equipment, and packs production PNGs. It never builds a human body or face from circles, rectangles or polygons. The golem uses existing stone pixels as articulated cutouts. Equipment masks and attachments affect weapons, not synthesized anatomy.

`python scripts/build-asset-motion.py` requires Pillow and the acquired originals. `node scripts/build-sprites.mjs` / `npm run assets` validates the checked-in output; ordinary builds do not require Python or generate artwork.

Each hero has a 512×320 atlas of 64×64 cells, foot pivot [32,52], and 36 timeline poses: idle 2, walk 4, basic attack 6, skill 1 6, skill 2 8, hurt 2, death 5, spawn 3. Basic/skill clips include preparation, release and recovery. There are 648 timeline slots, including intentionally reused poses; build-summary.json records the distinct raster count. Original pixel density is preserved without resampling bodies. Portraits use the approved stills.

The art has two side-facing views, obtained by mirroring the same texture. It does not claim eight separately authored directions. Eight gameplay headings are mapped by `src/client/hero-atlas.ts`. This reduces decoded hero-atlas RGBA memory from 81 MiB to 11.25 MiB and texture views from 5,184 to 648. This is a texture-allocation comparison, not a whole-process RAM measurement.

## Runtime synchronization

`sampleHeroAnimation` reads the existing action start, impact and recovery ticks. It never emits damage or moves a gameplay entity. Basic/skill 1 releases start at timeline frame 2; skill 2 at frame 3. Flurry, vital combo, triple rune and primordial fissure advance on all three committed impacts. Persistent fields recover after the initial release while their server pulses continue independently. Actual HIT events trigger recoil/tint; actions retain their committed clock. Death takes priority and uses the existing death tick.

The renderer caches 36 textures per hero, uses nearest sampling and integer sprite positions, and mirrors at drawing time. The real game, art lab and gallery read the same atlas layout. No server, shared AI, collision, skill, economy or balance source was changed during this integration; `artifacts/asset-motion/gameplay-preservation.json` records the 17-file SHA-256 comparison against the start-of-task baseline.

## Evidence and limits

- `artifacts/asset-motion/student-real-combat.webm` and `host-real-combat.webm`: actual HTTP/WebSocket room, one human student and 29 AI, normal speed setting. The final videos are sequential captures of different intervals of the same match, with one WebGL camera and one encoder active at a time; see sequential-recording.json. The student answered 20 ordinary quiz questions and paid the normal costs to reach level 5. No damage, AI or battle-state injection was used.
- `skills-and-death.webm`: staged initial 3-versus-3 placement with the production combat engine and renderer. All six priority-hero skills, hits, projectiles and deaths occur through the actual AI.
- `stress-all-18.png` and `verification.json`: all 18 types represented among 30 heroes plus 84 minions; all 36 skills observed during the fixture run. This fixture runs the real combat engine in the browser, not an HTTP classroom room.
- `performance-no-record.json`: separate actual-server performance run without recording. Keep this separate from the two-view recording measurements.
- `review.html`: video playback, all-hero frame inspection, source comparison and raw results.

Measurements are local Windows Chromium on the reported Intel CPU/GPU. The initial two simultaneous video recordings imposed substantial frame pacing and server scheduling delays; final delivery uses sequential capture instead. The stress run with recording disabled is reported separately (p95 33.3ms). The no-record actual-server run measured p95 16.7ms and 800 simulation ticks in 40 seconds with 30 AI heroes, peak 71 minions. A 60 fps median is not a guarantee of sustained 60 fps, and school tablets/phones were not measured. Tests validate all 18 basic and 36 first skill releases, repeated-hit boundaries, visible PNG frames, distinct action streams, silhouettes and HTTP/WebSocket compatibility. Existing historical ART_REWORK_REPORT.md and earlier screenshots describe older assets.
