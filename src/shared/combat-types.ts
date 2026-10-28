import type { Lane, Team, Position, CombatTeam } from './types.js';

export interface Point { x: number; y: number }
export type UnitKind = 'HERO' | 'MONSTER' | 'MELEE_MINION' | 'RANGED_MINION' | 'OUTER' | 'INNER' | 'GUARD' | 'NEXUS';
export type ActionState = 'SPAWNING' | 'ADVANCE' | 'APPROACH' | 'HOLD' | 'WINDUP' | 'RECOVERY' | 'REPOSITION' | 'RETREAT' | 'CONTROLLED' | 'DEAD';
export interface Status {
  type: string; sourceId: string; sourcePlayerId?: string; untilTick: number; magnitude: number;
}
export interface ShieldLayer { sourceId: string; sourcePlayerId?: string; amount: number; untilTick: number; seq: number }
export interface Source {
  entityId: string; deploymentId: string; playerId?: string; ownedHeroInstanceId?: string;
  heroDefinitionId?: string; team: CombatTeam; kind: UnitKind; power: number; maxHp: number;
}
export interface Action {
  id: string; skillId: string | null; targetIds: string[]; point: Point; origin: Point; direction: Point;
  startTick: number; impactTicks: number[]; recoveryEndTick: number; processedHits: number[];
  hitIds: string[]; source: Source; cancelled?: boolean;
  reservedPoints?: Record<string, Point>;
}
export interface CombatUnit extends Point {
  entityId: string; deploymentId: string; kind: UnitKind; team: CombatTeam; lane: Lane | null;
  position?:Position;
  campId?:string; monsterKind?:'WOLF'|'GOLEM'|'WISP'; home?:Point; leashReset?:boolean;
  jungle?:{stage:'HOME'|'GANK'|'INVADE'|'RECOVER';campId:string|null;visited:string[];nextDecisionTick:number;commitUntilTick:number;assistLane:Lane|null;reason:string};
  ownerPlayerId?: string; ownedHeroInstanceId?: string; heroDefinitionId?: string; level: number;
  role: string; hp: number; maxHp: number; armor: number; power: number; range: number;
  speed: number; radius: number; attackIntervalMs: number; windupMs: number; recoveryMs: number;
  projectileSpeed: number; previousX: number; previousY: number; vx: number; vy: number;
  facingX: number; facingY: number; state: ActionState; createdTick: number; deathTick?: number;
  shield: number; statuses: Status[]; shields: ShieldLayer[]; protected: boolean;
  action: Action | null; actionId: string | null; actionStartTick: number; impactTick: number; recoveryEndTick: number;
  targetId: string | null; targetChosenTick: number; nextBasicReadyTick: number; nextAiTick: number;
  skillReadyAt: Record<string, number>; goal: Point | null; path: Point[]; pathGoal: Point | null;
  pathPlannedTick: number; lateral: number; progress: number; slotIndex: number; slotUntilTick: number;
  engageX: number; tacticalUntilTick: number; retreatDistance: number; debugReason: string;
  engagePoint?: Point;
  unreachableTargets?: Record<string,number>;
  navigationProgress?: {goal:Point;distance:number;tick:number};
  ccChainStartTick: number; lastHardCcActiveTick: number; hardCcImmuneUntilTick: number;
  forcedMove: { direction: Point; remaining: number; speed: number; untilTick: number } | null;
  damageLedger: { playerId: string; tick: number; value: number; sourceId: string }[];
  recentDamage: { tick: number; value: number; sourceId: string; targetId?: string }[];
  supportLedger: { playerId: string; tick: number }[];
  marks: Record<string, { count: number; untilTick: number }>;
  towerTargetId: string | null; towerStreak: number; lastAttackTick: number;
  lastProgressTick: number; lastProgressX: number; lastProgressY: number; stalledTicks: number;
}
export interface HitPayload {
  skillId: string | null; coefficient: number; structureMultiplier: number; armorIgnore?: number;
  statuses?: { type: string; durationMs: number; magnitude: number }[];
  knockback?: number; mark?: 'rune' | 'sigil'; basic?: boolean; radius?: number;
}
export interface Projectile extends Point {
  entityId: string; source: Source; targetId: string | null; lastTarget: Point;
  direction: Point; speed: number; radius: number; remaining: number; createdTick: number;
  effectId: string; actionId: string; mode: 'HOMING' | 'LINE' | 'BURST'; maxTargets: number;
  hitIds: string[]; payload: HitPayload; falloff: number; minFalloff: number;
}
export interface PersistentEffect extends Point {
  entityId: string; source: Source; effectId: string; actionId: string; shape: string;
  radius: number; width: number; depth: number; direction: Point; createdTick: number; untilTick: number;
  hitTicks: number[]; processedTicks: number[]; coefficients: number[]; payload: HitPayload;
  healing: boolean; maxTargets: number; endsOnSourceDeath: boolean; reduction: number;
}
export interface CombatEvent extends Point {
  eventId: string; eventSeq: number; matchId: string; tick: number; type: string;
  sourceEntityId: string | null; targetEntityIds: string[]; actionId: string; effectId: string;
  params: Record<string, number | string>;
}
export interface CombatStats {
  heroDamage: number; minionDamage: number; structureDamage: number; healing: number;
  shielding: number; damageTaken: number; ccSeconds: number; kills: number; assists: number;
  deaths: number; towerKills: number;
}
export interface CombatState {
  matchId: string; seed: number; tick: number; battleStartTick: number; nextWaveTick: number;
  units: CombatUnit[]; structures: CombatUnit[]; projectiles: Projectile[]; effects: PersistentEffect[];
  events: CombatEvent[]; eventSeq: number; entitySeq: number; actionSeq: number; wave: number;
  camps?:{id:string;homeTeam:Team;name:string;kind:'WOLF'|'GOLEM'|'WISP';x:number;y:number;entityId:string|null;respawnTick:number;clearedBy:Team|null}[];
  winner: Team | 'DRAW' | null; teamKills: Record<Team, number>; stats: Record<string, CombatStats>;
  cooldowns: Record<string, { instance: Record<string, Record<string, number>>; shared: Record<string, number> }>;
  scheduled: { tick: number; kind: string; source: Source; targetId: string; actionId: string; coefficient: number; hitIds: string[] }[];
  decisions?: {tick:number;entityId:string;targetId:string|null;state:ActionState;reasonCode:string}[];
  metrics: { firstHitTick: number | null; destroyed: { id: string; tick: number; kind: string }[];
    wavesSpawned: number; spawnedMinions: number; maxUnits: number; stalledEvents: number; invalidPositions: number; tickCount: number;
    stalls: {tick:number;entityId:string;heroId:string;kind:string;x:number;y:number;goal:Point|null;reason:string}[]; };
}
