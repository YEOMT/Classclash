/** Class Clash policies, not an implementation of any other game's AI. */
export const ENGINE_TACTICS={
 targetMinHoldTicks:16,
 targetSwitchMargin:12,
 maximumChaseTicks:100,
 maximumChaseDistance:240,
 slotTtlTicks:16,
 rangedRetreatHoldTicks:24,
 stuckRecoveryTicks:24,
 stuckRetargetTicks:48,
 fullStallTicks:100,
 blockedTargetRetryTicks:60,
} as const;
