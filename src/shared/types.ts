export type Team = 'A' | 'B';
export type Lane = 'TOP' | 'MID' | 'BOTTOM';
export type Position = Lane | 'JUNGLE';
export type CombatTeam = Team | 'NEUTRAL';
export type Phase = 'LOBBY' | 'OPENING_QUIZ' | 'INITIAL_MAINTENANCE' | 'COUNTDOWN' | 'BATTLE' | 'RESULT' | 'CANCELLED';
export type PlayerStatus = 'WAITING' | 'INITIAL_MAINTENANCE' | 'READY' | 'DEPLOYING' | 'ACTIVE' | 'DEAD_MAINTENANCE' | 'FINISHED';
export type BotProfile = 'BASIC' | 'STANDARD' | 'SKILLED';
export interface OwnedHero {
  ownedHeroInstanceId: string; heroDefinitionId: string; rarity: 'COMMON' | 'ADVANCED' | 'LEGENDARY';
  level: number; powerEnhancements: number; vitalityEnhancements: number;
  skillReadyAt: Record<string, number>; obtainedFrom: 'STARTER' | 'NORMAL_DRAW' | 'PREMIUM_DRAW';
}
export interface PlayerStats {
  answered: number; correct: number; openingAnswered: number; openingCorrect: number;
  earned: number; spent: number; deployments: number; kills: number; assists: number; deaths: number;
  heroDamage: number; structureDamage: number; healing: number; shielding: number;
  damageTaken: number; ccSeconds: number; towerKills: number; heroesUsed: string[];
}
export interface PublicPlayer {
  playerId: string; name: string; team: Team; isBot: boolean; botProfile?: BotProfile;
  online: boolean; state: PlayerStatus; activeEntityId: string | null;
  heroDefinitionId: string | null; level: number; lane: Position; quizProgress: number;
}
export interface PublicQuiz {
  attemptId: string; kind: 'OPENING' | 'BATTLE'; index: number; total: number; completed: boolean;
  question: { id: string; text: string; options: { id: string; text: string }[] } | null;
  lastAnswer: { correct: boolean; correctText: string } | null;
}
export interface SelfState {
  playerId: string; gold: number; inventory: OwnedHero[]; selectedOwnedHeroId: string | null;
  selectedLane: Position; starterChoiceUsed: boolean; hasDeployedThisMatch: boolean;
  redeployNotBeforeTick: number; quizAvailableAtTick: number; quiz: PublicQuiz | null;
  deathId: string | null;
  ledgerRevision: number; stats: PlayerStats; sharedSkillReadyAt: Record<string, number>;
}
export interface Award { id: string; name: string; playerIds: string[]; value: number; aiOnly: boolean }
export interface MatchResult {
  matchId: string; winner: Team | 'DRAW' | null; cancelled: boolean; battleSeconds: number;
  awards: Award[]; players: { playerId: string; name: string; team: Team; isBot: boolean; stats: PlayerStats }[];
}
export interface RoomSnapshot {
  protocolVersion: 1; roomId: string; roomCode: string; matchId: string | null;
  phase: Phase; phaseRevision: number; paused: boolean; tick: number;
  battleStartTick: number | null; countdownEndTick: number | null; snapshotSeq: number;
  players: PublicPlayer[]; self: SelfState | null; battle: import('./combat-types.js').CombatState | null;
  result: MatchResult | null; quizBankCount: number; connectionEpoch: number; recovered: boolean;
  testSpeed?: number;
  hostStudents?: SelfState[];
  diagnostics?: {tickP50:number;tickP95:number;tickP99:number;backlogMs:number;clients:number;bots:{playerId:string;lastAction:string;lastError:string|null}[];stalls:{tick:number;playerId:string;reason:string}[]};
}
export interface ClientCommand {
  commandId: string; matchId: string | null; expectedPhaseRevision: number;
  connectionEpoch: number; ledgerRevision?: number; type: string; payload: Record<string, unknown>;
}
export interface CommandReply {
  commandId: string; status: 'APPLIED' | 'REPLAYED' | 'REJECTED'; serverTick: number;
  phaseRevision: number; errorCode?: string; message?: string; publicResult?: unknown;
}
export interface SessionInfo { roomId: string; roomCode: string; token: string; playerId: string | null; role: 'host' | 'student' }
