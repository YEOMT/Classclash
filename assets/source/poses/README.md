# Pose tracks

Every hero has an explicit three-motion tuple in `heroes.json`, selecting basicAttack/skill1/skill2. The `pose` function produces shoulders, torso lean, two hand anchors, weapon angle, crouch/rise, foot separation and release phase independently. Weapon drawing rasterizes the changed weapon geometry into each PNG frame. Action phases are prepared in separate frames; the client maps them onto authoritative server actionStartTick/impactTick/recoveryEndTick, never creates damage from animation callbacks.

Frame counts: idle 2, walk 4, basicAttack 6, skill1 6, skill2 8, hurt 2, death 5, spawn 3, each at 8 directions. Shared locomotion does not share hero attack sequences. Multi-hit skills alternate the hands or stamp repeated runes.
