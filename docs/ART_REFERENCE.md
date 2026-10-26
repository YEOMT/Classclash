# Class Clash original pixel art

Reviewed 2026-10-26 (Asia/Seoul). The [official Teamfight Manager Steam page](https://store.steampowered.com/app/1372810/Teamfight_Manager/) was opened through the web tool and its embedded official video viewed in the in-app browser. The official description establishes distinct champion characteristics, a repeatable skill and an ultimate. Only the readability principle—small, recognizable character equipment, compact role silhouettes and a separate scoreboard—is used as reference. Class Clash does not copy that game's deathmatch timer, art, UI, character designs, logo or audio. No frame-by-frame measurements or extraction of its internal data were performed.

## Authorship and source

All 18 hero atlases are original code-authored pixel art created for this project. No downloaded third-party sprite, traced image, stock art, placeholder geometry or generative image asset is included. Source palettes and hero-specific equipment/motion choices are in `assets/source/heroes.json`. Integer raster parts, joint poses, direction projections, hand layering and PNG encoder are in `scripts/build-sprites.mjs`. Rig and pose authoring notes are in `assets/source/rigs` and `assets/source/poses`.

`npm run assets` deterministically generates 18 PNG atlases, portraits, per-hero animation metadata, a manifest and a contact sheet. Each atlas is 1024 × 1152 with transparent 64 × 64 cells, fixed foot pivot [32,52], eight directions and 36 poses per direction (288 frames per hero, 5,184 total). Body limits are 32 × 40 or 40 × 48 for large rigs; padding permits weapon swings. Ten source palette colors per hero are used, with a temporary hurt brightness overlay. The runtime uses the same PNG atlases for the gallery and combat, with nearest-neighbor sampling.

| Hero | Original silhouette | Basic / skill 1 / skill 2 motion |
|---|---|---|
| 성전사 | crown helm, white cape, round shield, short mace | overhead smash / shield thrust / sanctuary raise |
| 검사 | blue tunic, long thin sword | side slash / vertical parry / low flash cut |
| 격투가 | exposed arms, red gloves, headband | punch / alternating flurry / crouch and uppercut |
| 궁수 | green cloak, feather, curved bow | draw release / heavy draw / raised sky shot |
| 화염술사 | flame hat, red robe, fire staff | staff release / raised fire orb / crosswise wall drawing |
| 얼음술사 | triangle hat, blue robe, crystal staff | shard release / fan arms / staff stamp |
| 사제 | white hood, long sleeves, cross staff | light release / extended heal / prayer raise |
| 야만인 | broad bare arms, fur shoulders, two-hand axe | heavy smash / spinning axe / leap pose |
| 수도승 | bald head, ochre robe, beads, long staff | thrust / wide repel / raised bell |
| 철갑기사 | full armor, square shield, short flail | iron swing / crouched charge / wide shield stance |
| 수호골렘 | asymmetric rock shoulders, moss, green chest stone | fist smash / two-arm earth slam / roar |
| 암살자 | black hood, purple scarf, two daggers | stab / low shadow jump / alternating cross combo |
| 석궁병 | tan coat, cap, broad crossbow | fire/recoil / braced heavy bolt / binding preparation |
| 번개술사 | dark blue cloak, yellow crown, fork staff | orb release / raised chain / overhead thunder |
| 음유시인 | purple slanted hat, sleeves, lute | pluck / melody sweep / wide dissonant sweep |
| 룬 마법사 | navy hood, open book, three small rune chips | book release / repeated rune stamps / two-arm resonance |
| 고대의 존재 | stone mask, narrow bronze waist, long arms | heavy arm smash / palm sigil / two-arm fissure |
| 수호령 | beast mask, broad mantle, hand shield, hovering hem | palm / reaching soul guard / spread-arm barrier |

## Verification status

The generated `public/assets/heroes/contact-sheet.png` was opened and inspected at its native dimensions through `view_image`: all 18 heroes have different non-palette silhouettes and visible weapons, and idle versus attack release poses differ. The generator rejects identical basic/skill action streams, missing hero entries and oversized atlases. `tests/content.test.ts` also decodes actual PNG pixel buffers, verifies every directional frame has visible pixels, checks hand/projectile socket proximity and checks 18 distinct alpha silhouettes. Four content/art tests passed on 2026-10-26 under Node 24.19.0.

These checks establish the original asset set and metadata; they do not by themselves establish in-game action timing, classroom-device readability or browser rendering performance. Actual combat/browser evidence is recorded separately in TEST_REPORT.md and visual QA artifacts. Art-gallery playback is explicitly labeled as an asset inspection tool, not a gameplay recording.

## Actual browser asset review

The running local server's `/art-gallery.html` was opened in the in-app browser on 2026-10-26. Initial sequential loading left empty stages while later atlases loaded; this was fixed by parallel loading and drawing each hero's first frame as soon as its PNG and metadata decode. The corrected page displayed all 18 sprites and its 5,184-frame loaded status. The reviewer used the actual pause, single-frame, state and direction controls, inspecting E basic release, NW skill 2 release and SE skill 1 release. Round versus square shields, thin sword versus axe, gloves, bow versus crossbow, robes/staves, lute, book and both large legendary masks remained distinguishable. Preview is 3× nearest-neighbor at browser viewport 1266×712, not a claim of real tablet hardware testing.

Saved screenshots (relative to repository root):

- `artifacts/visual/art-gallery-basic.png`: E basic attack, paused.
- `artifacts/visual/art-gallery-skill2-nw.png`: NW skill 2, fourth frame.
- `artifacts/visual/art-gallery-legends.png`: lower gallery and completed-load status.
- `artifacts/visual/art-gallery-skill1-se.png`: SE skill 1, third frame, legendary silhouettes.

Reproduce: start the app, open `/art-gallery.html`, select state and direction, pause, and step frames. `tests/hero-skills.test.ts` separately runs all 36 real server skill mechanisms, including marks, projectile interception, interrupted casts, roots, barriers, and stacked bard buffs. It passed 48/48 tests in the current working tree; these are server tests rather than browser animations.
