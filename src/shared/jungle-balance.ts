export const JUNGLE_BALANCE={
 respawnTicks:1200,leashRadius:135,aggroRadius:110,retreatHpRatio:.28,invadeHpRatio:.55,
 assistCommitTicks:240,invadeCommitTicks:400,clearHealRatio:.18,clearHasteTicks:500,
 monsters:{
  WOLF:{hp:220,power:9,armor:5,speed:58,range:16,radius:13,attackIntervalMs:1250,windupMs:300,projectileSpeed:0},
  WISP:{hp:240,power:11,armor:8,speed:46,range:90,radius:14,attackIntervalMs:1500,windupMs:400,projectileSpeed:220},
  GOLEM:{hp:320,power:13,armor:12,speed:34,range:19,radius:18,attackIntervalMs:1700,windupMs:500,projectileSpeed:0},
 },
} as const;
