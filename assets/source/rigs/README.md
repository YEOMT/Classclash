# Original pixel rigs

`scripts/build-sprites.mjs` rasterizes six authored joint layouts: light, armored, robe, large/golem, ancient, spirit. Legs, shoulders, hands, head and ground pivot are separate; the spirit intentionally omits visible legs. Joint coordinates and face orientation resolve eight directions from front/back/side/diagonal poses. Equipment is composed in direction-dependent front/back order; shields retain the specified off-hand anchor.

The generator uses integer polygon/line rasterization only: no antialiasing, external sprite or runtime Canvas rasterization. Palette colors are declared per hero in `assets/source/heroes.json`. The raster source parts and poses are implemented in the named `drawHead`, `drawBody`, `drawWeapon`, `pose` functions. They are authored original game art, not generated placeholders or recolored copies of one silhouette.
