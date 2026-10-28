import { randomUUID, randomInt } from 'node:crypto';
import {POSITIONS} from '../shared/battle-map.js';
import type { BotProfile, ClientCommand, CommandReply, Position, MatchResult, OwnedHero, Phase, PlayerStats, PlayerStatus, RoomSnapshot, SelfState, Team } from '../shared/types.js';
import { hash32, nextRandom } from '../shared/random.js';
import { HEROES, HERO_BY_ID } from '../shared/heroes.js';
import { createCombat, deployHero, stepCombat } from './combat.js';
import type { CombatState } from '../shared/combat-types.js';
import { DEFAULT_BANK, newAttempt, parseQuizBank, publicQuiz, simulatedOption, type Question, type QuizAttempt } from './quiz.js';
import { RuleError, requireRule } from './errors.js';
import { makeResult } from './awards.js';
import defaults from '../shared/balance.js';
import { BOT_TACTICS } from '../shared/bot-balance.js';
import { CURRENT_VERSIONS, type RuntimeVersions } from './versions.js';

export interface BotState {
  streams: Record<string,{value:number}>; nextDecisionTick: number; decisionCounter: number;
  pendingAnswer: { at: number; attemptId: string; questionId: string; optionId: string } | null;
  maintenanceKey: string; purchases: number; drawn: boolean; selected: boolean;
  tendency: 'BALANCED' | 'GROWTH' | 'COLLECTOR'; preferredRole: string; lastError: string | null;
  maintenanceStartedTick: number; lastProgressTick: number; lastAction: string;
}
export interface Player {
  playerId: string; name: string; team: Team; isBot: boolean; botProfile: BotProfile;
  sessionHash: string; connectionEpoch: number; online: boolean; state: PlayerStatus;
  gold: number; starterChoiceUsed: boolean; inventory: OwnedHero[]; selectedOwnedHeroId: string | null;
  selectedLane: Position; activeEntityId: string | null; hasDeployedThisMatch: boolean;
  deathId: string | null; redeployNotBeforeTick: number; sharedSkillReadyAt: Record<string,number>;
  quizAttempt: QuizAttempt | null; quizAvailableAtTick: number; quizSeen: string[];
  ledgerRevision: number; stats: PlayerStats; bot: BotState | null;
}
export interface RoomData {
  version: 1; roomId: string; roomCode: string; hostSessionHash: string; hostConnectionEpoch: number;
  phase: Phase; phaseRevision: number; lobbyEpoch: number; paused: boolean; players: Player[];
  quizBank: Question[]; matchId: string | null; seed: number; tick: number; battleStartTick: number | null;
  countdownEndTick: number | null; combat: CombatState | null; result: MatchResult | null;
  replies: Record<string,{fingerprint:string;reply:CommandReply}>;
  rng: {value:number}; drawRng: {value:number}; deterministicDraws: boolean;
  createdAt: string; updatedAt: string; recovered: boolean; nextBotSerial: number;
  versions: RuntimeVersions; botDiagnostics: {tick:number;playerId:string;reason:string}[];
}
export type Actor = 'host' | string;
export function zeroStats(): PlayerStats { return {answered:0,correct:0,openingAnswered:0,openingCorrect:0,earned:0,spent:0,deployments:0,kills:0,assists:0,deaths:0,heroDamage:0,structureDamage:0,healing:0,shielding:0,damageTaken:0,ccSeconds:0,towerKills:0,heroesUsed:[]}; }
export function createRoom(roomCode: string, hostSessionHash: string, seed=randomInt(1,0x7fffffff), deterministicDraws=false): RoomData {
  return {version:1,roomId:`room-${randomUUID()}`,roomCode,hostSessionHash,hostConnectionEpoch:0,phase:'LOBBY',phaseRevision:0,lobbyEpoch:0,paused:false,players:[],quizBank:structuredClone(DEFAULT_BANK),matchId:null,seed,tick:0,battleStartTick:null,countdownEndTick:null,combat:null,result:null,replies:{},rng:{value:hash32(`${seed}/quiz`)},drawRng:{value:hash32(`${seed}/draw`)},deterministicDraws,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),recovered:false,nextBotSerial:1,versions:{...CURRENT_VERSIONS},botDiagnostics:[]};
}
export function addPlayer(r:RoomData,name:string,sessionHash:string,options?:{bot?:boolean;profile?:BotProfile;team?:Team;tendency?:BotState['tendency'];preferredRole?:string}):Player {
  requireRule(r.phase==='LOBBY','INVALID_PHASE'); requireRule(r.players.length<30,'ROOM_FULL');
  name=name.replace(/[\u0000-\u001f\u007f]/g,'').trim(); requireRule(name.length>=2&&name.length<=12,'INVALID_INPUT','이름을 2~12자로 입력하세요.');
  const team=options?.team || (r.players.filter(p=>p.team==='A').length<=r.players.filter(p=>p.team==='B').length?'A':'B');
  requireRule(r.players.filter(p=>p.team===team).length<15,'TEAM_FULL');
  const serial=r.nextBotSerial++;
  const p:Player={playerId:options?.bot?`bot-${String(serial).padStart(3,'0')}`:`player-${randomUUID()}`,name,team,isBot:!!options?.bot,botProfile:options?.profile||'STANDARD',sessionHash,connectionEpoch:0,online:!!options?.bot,state:'WAITING',gold:0,starterChoiceUsed:false,inventory:[],selectedOwnedHeroId:null,selectedLane:POSITIONS[(serial-1)%POSITIONS.length]!,activeEntityId:null,hasDeployedThisMatch:false,deathId:null,redeployNotBeforeTick:0,sharedSkillReadyAt:{},quizAttempt:null,quizAvailableAtTick:0,quizSeen:[],ledgerRevision:0,stats:zeroStats(),bot:null};
  if(p.isBot) p.bot={streams:{},nextDecisionTick:0,decisionCounter:0,pendingAnswer:null,maintenanceKey:'',purchases:0,drawn:false,selected:false,tendency:options?.tendency||'BALANCED',preferredRole:options?.preferredRole||'AUTO',lastError:null,maintenanceStartedTick:0,lastProgressTick:0,lastAction:'WAITING'};
  r.players.push(p); return p;
}
function phase(r:RoomData,next:Phase){r.phase=next;r.phaseRevision++;}
function owned(p:Player,id:unknown){const h=p.inventory.find(x=>x.ownedHeroInstanceId===id);requireRule(h,'HERO_NOT_OWNED');return h;}
function maintenance(r:RoomData,p:Player){requireRule(!p.activeEntityId,'HERO_ALREADY_ACTIVE');requireRule((r.phase==='INITIAL_MAINTENANCE'&&p.state==='INITIAL_MAINTENANCE')||(r.phase==='BATTLE'&&p.state==='DEAD_MAINTENANCE'),'INVALID_PHASE');}
function spend(p:Player,cost:number){requireRule(p.gold>=cost,'INSUFFICIENT_GOLD');p.gold-=cost;p.stats.spent+=cost;p.ledgerRevision++;}
export function drawDefinition(ticketType:string,pool:string,u:number,v:number){
  requireRule(['NORMAL','PREMIUM'].includes(ticketType),'INVALID_DRAW_POOL');
  requireRule((ticketType==='NORMAL'?['ALL','tank','melee','ranged','mage','support']:['ALL','tank','melee','mage']).includes(pool),'INVALID_DRAW_POOL');
  const rarity=ticketType==='NORMAL'?(u<0.8?'COMMON':'ADVANCED'):(u<0.3?'COMMON':u<0.9?'ADVANCED':'LEGENDARY');
  const candidates=HEROES.filter(h=>h.rarity===rarity&&(pool==='ALL'||h.role===pool));
  requireRule(candidates.length,'INVALID_DRAW_POOL');return candidates[Math.min(candidates.length-1,Math.floor(v*candidates.length))];
}
function giveHero(p:Player,heroId:string,source:OwnedHero['obtainedFrom']):OwnedHero{
  const def=HERO_BY_ID[heroId];requireRule(def,'INVALID_INPUT');
  const hero:OwnedHero={ownedHeroInstanceId:`owned-${randomUUID()}`,heroDefinitionId:heroId,rarity:def.rarity,level:1,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:source};
  p.inventory.push(hero);if(!p.selectedOwnedHeroId)p.selectedOwnedHeroId=hero.ownedHeroInstanceId;return hero;
}
function startAttempt(r:RoomData,p:Player,kind:'OPENING'|'BATTLE'){
  p.quizAttempt=newAttempt(r.quizBank,kind,p.quizSeen,()=>nextRandom(r.rng));return publicQuiz(p.quizAttempt);
}
function enterMaintenance(r:RoomData){
  phase(r,'INITIAL_MAINTENANCE');for(const p of r.players){p.state='INITIAL_MAINTENANCE';if(p.quizAttempt)p.quizAttempt.completed=true;if(p.bot)p.bot.pendingAnswer=null;}
}
function deploy(r:RoomData,p:Player){
  requireRule(r.combat,'INVALID_PHASE');const hero=owned(p,p.selectedOwnedHeroId);
  const unit=deployHero(r.combat,{playerId:p.playerId,team:p.team,lane:p.selectedLane,hero,sharedSkillReadyAt:p.sharedSkillReadyAt});
  p.activeEntityId=unit.entityId;p.state='ACTIVE';p.hasDeployedThisMatch=true;p.stats.deployments++;
  if(!p.stats.heroesUsed.includes(hero.heroDefinitionId))p.stats.heroesUsed.push(hero.heroDefinitionId);
  return {entityId:unit.entityId,deploymentId:unit.deploymentId};
}
function resetPlayer(p:Player){
  p.state='WAITING';p.gold=0;p.starterChoiceUsed=false;p.inventory=[];p.selectedOwnedHeroId=null;p.activeEntityId=null;p.hasDeployedThisMatch=false;p.deathId=null;p.redeployNotBeforeTick=0;p.sharedSkillReadyAt={};p.quizAttempt=null;p.quizAvailableAtTick=0;p.quizSeen=[];p.ledgerRevision=0;p.stats=zeroStats();
  if(p.bot){p.bot.streams={};p.bot.nextDecisionTick=0;p.bot.decisionCounter=0;p.bot.pendingAnswer=null;p.bot.maintenanceKey='';p.bot.purchases=0;p.bot.drawn=false;p.bot.selected=false;p.bot.lastError=null;p.bot.maintenanceStartedTick=0;p.bot.lastProgressTick=0;p.bot.lastAction='WAITING';}
}
function apply(r:RoomData,actor:Actor,type:string,payload:Record<string,unknown>,ledgerRevision?:number):unknown{
  const hostTypes=['ADD_BOTS','REMOVE_BOT','ASSIGN_TEAM','AUTO_BALANCE','UPDATE_QUIZ_BANK','START_OPENING_QUIZ','CLOSE_OPENING_QUIZ','START_COUNTDOWN','PAUSE_ROOM','RESUME_ROOM','CANCEL_MATCH','REMATCH_TO_LOBBY'];
  if(hostTypes.includes(type)){
    requireRule(actor==='host','NOT_AUTHORIZED');
    if(['ADD_BOTS','REMOVE_BOT','ASSIGN_TEAM','AUTO_BALANCE','UPDATE_QUIZ_BANK','START_OPENING_QUIZ'].includes(type)) requireRule(r.phase==='LOBBY','INVALID_PHASE');
    if(type==='ADD_BOTS'){
      const count=Number(payload.count);requireRule(Number.isInteger(count)&&count>=1&&count<=30-r.players.length,'ROOM_FULL');
      const profile=(payload.profile||'STANDARD') as BotProfile;requireRule(['BASIC','STANDARD','SKILLED'].includes(profile),'INVALID_INPUT');
      const team=payload.team==='A'||payload.team==='B'?payload.team:undefined;
      if(team)requireRule(r.players.filter(p=>p.team===team).length+count<=15,'TEAM_FULL');
      for(let i=0;i<count;i++)addPlayer(r,`AI 별빛 ${String(r.nextBotSerial).padStart(2,'0')}`,'',{bot:true,profile,team,tendency:payload.tendency as BotState['tendency'],preferredRole:String(payload.preferredRole||'AUTO')});
    } else if(type==='REMOVE_BOT'){
      requireRule(payload.all===true||r.players.some(p=>p.playerId===payload.playerId&&p.isBot),'INVALID_INPUT');
      r.players=r.players.filter(p=>!p.isBot||(payload.all!==true&&p.playerId!==payload.playerId));
    } else if(type==='ASSIGN_TEAM'){
      const p=r.players.find(p=>p.playerId===payload.playerId);requireRule(p,'INVALID_INPUT');requireRule(payload.team==='A'||payload.team==='B','INVALID_INPUT');
      if(p.team!==payload.team)requireRule(r.players.filter(x=>x.team===payload.team).length<15,'TEAM_FULL');p.team=payload.team;
    } else if(type==='AUTO_BALANCE'){r.players.forEach((p,i)=>p.team=i%2?'B':'A');}
    else if(type==='UPDATE_QUIZ_BANK'){requireRule(typeof payload.text==='string','INVALID_INPUT');try{r.quizBank=parseQuizBank(payload.text);}catch(e){throw new RuleError('INVALID_INPUT',(e as Error).message);}return {count:r.quizBank.length};}
    else if(type==='START_OPENING_QUIZ'){
      requireRule(['A','B'].every(t=>r.players.some(p=>p.team===t)),'ROSTER_NOT_READY');
      if(payload.seed!==undefined){requireRule((typeof payload.seed==='number'&&Number.isInteger(payload.seed))||(typeof payload.seed==='string'&&payload.seed.trim().length>0&&payload.seed.length<=128),'INVALID_INPUT');r.seed=typeof payload.seed==='number'?payload.seed>>>0:hash32(String(payload.seed));}
      r.matchId=r.deterministicDraws?`match-sim-${r.seed}-${r.lobbyEpoch}`:`match-${randomUUID()}`;r.tick=0;r.battleStartTick=null;r.countdownEndTick=null;r.combat=null;r.result=null;r.paused=false;r.recovered=false;
      r.rng={value:hash32(`${r.seed}/quiz`)};r.drawRng={value:hash32(`${r.seed}/draw`)};
      for(const p of r.players){resetPlayer(p);startAttempt(r,p,'OPENING');}
      phase(r,'OPENING_QUIZ');
    } else if(type==='CLOSE_OPENING_QUIZ'){requireRule(r.phase==='OPENING_QUIZ','INVALID_PHASE');enterMaintenance(r);}
    else if(type==='START_COUNTDOWN'){
      requireRule(r.phase==='INITIAL_MAINTENANCE','INVALID_PHASE');
      requireRule(['A','B'].every(t=>r.players.some(p=>p.team===t&&p.state==='READY')),'ROSTER_NOT_READY');
      requireRule(payload.allowUnready===true||r.players.every(p=>p.state==='READY'),'ROSTER_NOT_READY','아직 준비하지 않은 학생이 있습니다.');
      phase(r,'COUNTDOWN');r.countdownEndTick=r.tick+100;
    } else if(type==='PAUSE_ROOM'||type==='RESUME_ROOM'){
      requireRule(!['LOBBY','RESULT','CANCELLED'].includes(r.phase),'INVALID_PHASE');r.paused=type==='PAUSE_ROOM';
    } else if(type==='CANCEL_MATCH'){
      requireRule(r.matchId&&!['RESULT','CANCELLED','LOBBY'].includes(r.phase),'INVALID_PHASE');finish(r,null,true);
    } else if(type==='REMATCH_TO_LOBBY'){
      requireRule(['RESULT','CANCELLED'].includes(r.phase),'INVALID_PHASE');r.lobbyEpoch++;r.matchId=null;r.combat=null;r.result=null;r.tick=0;r.battleStartTick=null;r.countdownEndTick=null;r.paused=false;r.replies={};r.botDiagnostics=[];
      for(const p of r.players)resetPlayer(p);phase(r,'LOBBY');
    }
    return {};
  }
  requireRule(actor!=='host','NOT_AUTHORIZED');const p=r.players.find(p=>p.playerId===actor);requireRule(p,'NOT_AUTHORIZED');
  if(['CLAIM_STARTER','DRAW_HERO','LEVEL_UP','ENHANCE_HERO','SELECT_HERO_AND_LANE','DEPLOY_HERO'].includes(type))maintenance(r,p);
  if(['DRAW_HERO','LEVEL_UP','ENHANCE_HERO','SELECT_HERO_AND_LANE','DEPLOY_HERO'].includes(type)&&p.hasDeployedThisMatch&&p.state==='DEAD_MAINTENANCE')requireRule(payload.deathId===p.deathId,'INVALID_PHASE','이전 사망 상태의 요청입니다. 현재 정비 화면에서 다시 시도하세요.');
  if(['DRAW_HERO','LEVEL_UP','ENHANCE_HERO'].includes(type))requireRule(ledgerRevision===p.ledgerRevision,'STALE_LEDGER');
  if(type==='CLAIM_STARTER'){
    requireRule(!p.starterChoiceUsed&&!p.hasDeployedThisMatch,'INVALID_PHASE');const heroId=String(payload.heroDefinitionId);requireRule(HERO_BY_ID[heroId]?.rarity==='COMMON','INVALID_INPUT');
    const hero=giveHero(p,heroId,'STARTER');p.starterChoiceUsed=true;p.ledgerRevision++;return hero;
  }
  if(type==='DRAW_HERO'){
    requireRule(p.inventory.length<120,'INVENTORY_FULL');const ticket=String(payload.ticketType),pool=String(payload.pool||'ALL');
    drawDefinition(ticket,pool,0,0);const cost=ticket==='NORMAL'?2:10;requireRule(p.gold>=cost,'INSUFFICIENT_GOLD');
    const rng=()=>r.deterministicDraws?nextRandom(r.drawRng):randomInt(0,0x100000000)/0x100000000;
    const definition=drawDefinition(ticket,pool,rng(),rng());spend(p,cost);return giveHero(p,definition.id,ticket==='NORMAL'?'NORMAL_DRAW':'PREMIUM_DRAW');
  }
  if(type==='LEVEL_UP'){
    const hero=owned(p,payload.ownedHeroInstanceId);requireRule(hero.level<5,'LEVEL_MAX');spend(p,defaults.growth.levelUpCosts[hero.level-1]);hero.level++;
    if(hero.level===2||hero.level===5)hero.skillReadyAt[HERO_BY_ID[hero.heroDefinitionId].skillIds[hero.level===2?0:1]]=r.tick;
    return hero;
  }
  if(type==='ENHANCE_HERO'){
    const hero=owned(p,payload.ownedHeroInstanceId),total=hero.powerEnhancements+hero.vitalityEnhancements;
    requireRule(total<3,'ENHANCEMENT_MAX');requireRule(payload.kind==='power'||payload.kind==='vitality','INVALID_INPUT');spend(p,defaults.growth.enhancementCosts[total]);if(payload.kind==='power')hero.powerEnhancements++;else hero.vitalityEnhancements++;return hero;
  }
  if(type==='SELECT_HERO_AND_LANE'){
    const hero=owned(p,payload.ownedHeroInstanceId);requireRule(POSITIONS.includes(payload.lane as Position),'INVALID_INPUT');p.selectedOwnedHeroId=hero.ownedHeroInstanceId;p.selectedLane=payload.lane as Position;return {};
  }
  if(type==='SET_READY'){
    requireRule(r.phase==='INITIAL_MAINTENANCE','INVALID_PHASE');requireRule(typeof payload.ready==='boolean','INVALID_INPUT');
    if(payload.ready){maintenance(r,p);owned(p,p.selectedOwnedHeroId);p.state='READY';}else{requireRule(p.state==='READY','INVALID_PHASE');p.state='INITIAL_MAINTENANCE';}return {};
  }
  if(type==='DEPLOY_HERO'){
    requireRule(r.phase==='BATTLE','INVALID_PHASE');requireRule(r.tick>=p.redeployNotBeforeTick,'REDEPLOY_WAIT',`사망 후 ${defaults.deployment.minimumDeadWaitSeconds}초가 지나면 출정할 수 있습니다.`);
    if(payload.deathId!==undefined)requireRule(payload.deathId===p.deathId,'INVALID_PHASE');return deploy(r,p);
  }
  if(type==='START_QUIZ'||type==='RESUME_QUIZ'){
    requireRule(r.phase==='BATTLE','INVALID_PHASE');if(p.quizAttempt?.kind==='BATTLE'&&!p.quizAttempt.completed)return publicQuiz(p.quizAttempt);
    requireRule(r.tick>=p.quizAvailableAtTick,'QUIZ_COOLDOWN');return startAttempt(r,p,'BATTLE');
  }
  if(type==='SUBMIT_ANSWER'){
    requireRule(r.phase==='OPENING_QUIZ'||r.phase==='BATTLE','INVALID_PHASE');const a=p.quizAttempt;
    requireRule(a&&!a.completed&&a.attemptId===payload.attemptId,'QUIZ_ALREADY_ANSWERED');const item=a.items[a.index];
    requireRule(item.id===payload.questionId,'QUIZ_ALREADY_ANSWERED');requireRule(item.options.some(o=>o.id===payload.optionId),'INVALID_INPUT');
    const correct=item.correctOptionId===payload.optionId;a.lastAnswer={correct,correctText:item.options.find(o=>o.id===item.correctOptionId)!.text};
    p.stats.answered++;p.stats.correct+=Number(correct);p.stats.earned+=Number(correct);p.gold+=Number(correct);p.ledgerRevision++;
    if(a.kind==='OPENING'){p.stats.openingAnswered++;p.stats.openingCorrect+=Number(correct);}
    a.index++;if(a.index===a.items.length){a.completed=true;if(a.kind==='BATTLE')p.quizAvailableAtTick=r.tick+600;}
    if(r.phase==='OPENING_QUIZ'&&r.players.every(x=>x.quizAttempt?.completed))enterMaintenance(r);
    return {correct,correctText:a.lastAnswer.correctText,gold:p.gold};
  }
  throw new RuleError('INVALID_INPUT','지원하지 않는 요청입니다.');
}
export function command(r:RoomData,actor:Actor,c:ClientCommand,internal=false):CommandReply{
  const reply=(status:CommandReply['status'],extra:Partial<CommandReply>={}):CommandReply=>({commandId:c.commandId,status,serverTick:r.tick,phaseRevision:r.phaseRevision,...extra});
  try{
    requireRule(typeof c.commandId==='string'&&c.commandId.length>=8&&c.commandId.length<=200,'INVALID_INPUT');
    const p=r.players.find(p=>p.playerId===actor);requireRule(actor==='host'||p,'NOT_AUTHORIZED');
    if(!internal)requireRule(c.connectionEpoch===(actor==='host'?r.hostConnectionEpoch:p!.connectionEpoch),'STALE_CONNECTION');
    const scope=c.matchId||`${r.roomId}/${r.lobbyEpoch}`,key=`${scope}/${actor}/${c.commandId}`;
    const fingerprint=JSON.stringify({type:c.type,payload:c.payload,matchId:c.matchId});
    const old=r.replies[key];if(old){requireRule(old.fingerprint===fingerprint,'BAD_REPLAY');return {...old.reply,status:old.reply.status==='APPLIED'?'REPLAYED':old.reply.status};}
    requireRule(c.matchId===r.matchId,'STALE_MATCH');requireRule(c.expectedPhaseRevision===r.phaseRevision,'INVALID_PHASE');
    requireRule(!r.paused||['RESUME_ROOM','CANCEL_MATCH','PAUSE_ROOM'].includes(c.type),'ROOM_PAUSED');
    const result=apply(r,actor,c.type,c.payload||{},c.ledgerRevision);const done=reply('APPLIED',{publicResult:structuredClone(result)});
    r.replies[key]={fingerprint,reply:done};r.updatedAt=new Date().toISOString();return done;
  }catch(e){if(!(e instanceof RuleError))throw e;return reply('REJECTED',{errorCode:e.code,message:e.message});}
}
export function directCommand(r:RoomData,actor:Actor,type:string,payload:Record<string,unknown>={},id=`request-${randomUUID()}`):CommandReply{
  const p=r.players.find(p=>p.playerId===actor);return command(r,actor,{commandId:id,type,payload,matchId:r.matchId,expectedPhaseRevision:r.phaseRevision,connectionEpoch:actor==='host'?r.hostConnectionEpoch:p?.connectionEpoch||0,ledgerRevision:p?.ledgerRevision},true);
}
function botRandom(r:RoomData,p:Player,domain:string){const b=p.bot!;b.streams[domain]??={value:hash32(`${r.seed}/bot/${p.playerId}/${domain}`)};return nextRandom(b.streams[domain]);}
function botCommand(r:RoomData,p:Player,type:string,payload:Record<string,unknown>={}){
  const b=p.bot!,result=directCommand(r,p.playerId,type,{...payload,...(p.state==='DEAD_MAINTENANCE'?{deathId:p.deathId}:{})},`${r.matchId}/${p.playerId}/${++b.decisionCounter}`);b.lastError=result.errorCode||null;if(result.status==='APPLIED'){b.lastProgressTick=r.tick;b.lastAction=type;}return result.status==='APPLIED';
}
const roleWeights:Record<string,number>={tank:.20,melee:.27,ranged:.20,mage:.20,support:.13};
function roleNeed(r:RoomData,p:Player){
  const friends=r.players.filter(x=>x.team===p.team),counts:Record<string,number>={tank:0,melee:0,ranged:0,mage:0,support:0};
  for(const f of friends){const h=f.inventory.find(h=>h.ownedHeroInstanceId===f.selectedOwnedHeroId);if(h)counts[HERO_BY_ID[h.heroDefinitionId].role]++;}
  return Object.keys(roleWeights).sort((a,b)=>(roleWeights[b]*friends.length-counts[b])-(roleWeights[a]*friends.length-counts[a]))[0];
}
function choosePair(r:RoomData,p:Player){
  const candidates=p.inventory.flatMap(hero=>POSITIONS.map(lane=>{
    const friends=r.players.filter(x=>x.team===p.team&&x.playerId!==p.playerId&&(x.activeEntityId||x.state==='READY'||x.state==='INITIAL_MAINTENANCE')&&x.selectedLane===lane),enemies=r.players.filter(x=>x.team!==p.team&&x.activeEntityId&&x.selectedLane===lane);
    const roles=friends.flatMap(f=>{const h=f.inventory.find(h=>h.ownedHeroInstanceId===f.selectedOwnedHeroId);return h?[HERO_BY_ID[h.heroDefinitionId]!.role]:[];}),role=HERO_BY_ID[hero.heroDefinitionId].role;
    const need=role==='tank'&&!roles.includes('tank')?24:role==='support'&&friends.length>=4&&!roles.includes('support')?18:['ranged','mage'].includes(role)&&roles.filter(x=>['tank','melee'].includes(x)).length>=3?12:0;
    const laneTowers=r.combat?.structures.filter(s=>s.team!==p.team&&s.lane===lane)||[];
    const outerDown=laneTowers.some(s=>s.kind==='OUTER'&&s.hp<=0),innerDown=laneTowers.some(s=>s.kind==='INNER'&&s.hp<=0);
    const tower=laneTowers.find(s=>s.hp>0&&!s.protected)||r.combat?.structures.filter(s=>s.team!==p.team&&s.lane===null&&s.hp>0&&!s.protected).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    const wave=r.combat?.units.some(u=>u.team===p.team&&u.lane===lane&&u.hp>0&&u.kind.includes('MINION'));
    const opportunity=(outerDown?BOT_TACTICS.outerBreachOpportunity:0)+(innerDown?BOT_TACTICS.innerBreachOpportunity:0)+(tower?(1-tower.hp/tower.maxHp)*BOT_TACTICS.damagedObjectiveWeight:0)+(wave&&friends.length>enemies.length?1:0);
    const teamSize=r.players.filter(x=>x.team===p.team).length;
    const otherFriends=r.players.filter(x=>x.team===p.team&&x.playerId!==p.playerId&&(x.activeEntityId||x.state==='READY'||x.state==='INITIAL_MAINTENANCE')&&x.selectedLane!==lane).length;
    const allowance=lane==='JUNGLE'?Math.max(1,Math.floor(teamSize/5)):opportunity>0?Math.ceil(teamSize*BOT_TACTICS.maxAssaultFraction):Math.ceil(teamSize/3);
    const population=Math.max(0,friends.length+1-allowance)+Math.max(0,friends.length-otherFriends-7);
    const jungleFit=lane==='JUNGLE'?(['tank','melee'].includes(role)?8:-8):0;
    const balanceScore=(r.phase==='INITIAL_MAINTENANCE'?-friends.length*45+(friends.length>=allowance?-120:0):-friends.length*3)+(lane==='JUNGLE'&&friends.length>=allowance?-1500:0);
    const laneScore=BOT_TACTICS.enemyPressureWeight*(enemies.length-friends.length)+BOT_TACTICS.objectiveWeight*opportunity-BOT_TACTICS.populationWeight*population;
    return {hero,lane,score:balanceScore+jungleFit+(hero.level-1)*10+(hero.powerEnhancements+hero.vitalityEnhancements)*5+(hero.level>=2?8:0)+(hero.level===5?8:0)+need+(hero.ownedHeroInstanceId===p.selectedOwnedHeroId?6:0)+8*laneScore+botRandom(r,p,'managerTieBreak')};
  }));return candidates.sort((a,b)=>b.score-a.score)[0];
}
export function tickBots(r:RoomData){
  if(r.paused||['LOBBY','RESULT','CANCELLED','COUNTDOWN'].includes(r.phase))return;
  for(const p of r.players.filter(x=>x.isBot)){
    const b=p.bot!,profile=defaults.bots[p.botProfile];
    const answering=p.quizAttempt&&!p.quizAttempt.completed;
    if(answering){
      if(!b.pendingAnswer){const a=p.quizAttempt!,item=a.items[a.index];b.pendingAnswer={at:r.tick+Math.ceil((profile.answerSeconds[0]+botRandom(r,p,'quizDelay')*(profile.answerSeconds[1]-profile.answerSeconds[0]))*20),attemptId:a.attemptId,questionId:item.id,optionId:simulatedOption(item,botRandom(r,p,'quizAccuracy')<profile.correctProbability,()=>botRandom(r,p,'wrongChoice'))};}
      if(r.tick>=b.pendingAnswer.at){const pending=b.pendingAnswer;b.pendingAnswer=null;botCommand(r,p,'SUBMIT_ANSWER',pending);}
    }
    if(r.phase==='OPENING_QUIZ'||p.state==='READY')continue;
    if(p.state==='ACTIVE'){
      if(!answering&&r.tick>=p.quizAvailableAtTick)botCommand(r,p,'START_QUIZ');continue;
    }
    if(!['INITIAL_MAINTENANCE','DEAD_MAINTENANCE'].includes(p.state)||r.tick<b.nextDecisionTick)continue;
    if(answering&&p.quizAttempt!.kind==='BATTLE'&&(p.quizAttempt!.items.length-p.quizAttempt!.index<6||r.tick<p.redeployNotBeforeTick))continue;
    b.nextDecisionTick=r.tick+Math.ceil((profile.decisionSeconds[0]+botRandom(r,p,'managerDelay')*(profile.decisionSeconds[1]-profile.decisionSeconds[0]))*20);
    const key=p.deathId||'initial';if(b.maintenanceKey!==key){b.maintenanceKey=key;b.purchases=0;b.drawn=false;b.selected=false;b.maintenanceStartedTick=r.tick;b.lastProgressTick=r.tick;}
    // Long shopping never blocks the free manual-deployment path. Quiz and legal waiting are excluded.
    if(!answering&&r.tick-b.maintenanceStartedTick>=240&&p.inventory.length){b.drawn=true;b.purchases=2;}
    if(!answering&&r.tick>=p.redeployNotBeforeTick&&r.tick-b.lastProgressTick>=500){
      r.botDiagnostics.push({tick:r.tick,playerId:p.playerId,reason:'bot_stalled: 합법적인 기존 영웅 출정으로 복구'});r.botDiagnostics=r.botDiagnostics.slice(-100);b.selected=false;b.drawn=true;b.purchases=2;b.lastProgressTick=r.tick;
    }
    if(!p.starterChoiceUsed){const role=b.preferredRole==='AUTO'?roleNeed(r,p):b.preferredRole,heroes=HEROES.filter(h=>h.rarity==='COMMON'&&h.role===role);const hero=heroes[Math.floor(botRandom(r,p,'managerTieBreak')*heroes.length)]||HEROES[0];botCommand(r,p,'CLAIM_STARTER',{heroDefinitionId:hero.id});continue;}
    const current=p.inventory.find(h=>h.ownedHeroInstanceId===p.selectedOwnedHeroId)!;
    if(!b.drawn){b.drawn=true;const roles=new Set(p.inventory.map(h=>HERO_BY_ID[h.heroDefinitionId].role));let ticket:string|null=null;
      if(current.level>=3&&p.gold>=14)ticket='PREMIUM';else if(roles.size<(b.tendency==='COLLECTOR'?3:2)&&p.gold>=4&&b.tendency!=='GROWTH')ticket='NORMAL';
      if(ticket){botCommand(r,p,'DRAW_HERO',{ticketType:ticket,pool:ticket==='PREMIUM'?'ALL':roleNeed(r,p)});continue;}}
    if(!b.selected){const pair=choosePair(r,p);if(pair){botCommand(r,p,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:pair.hero.ownedHeroInstanceId,lane:pair.lane});b.selected=true;continue;}}
    const hero=p.inventory.find(h=>h.ownedHeroInstanceId===p.selectedOwnedHeroId)!;
    if(b.purchases<2){if(hero.level<5&&p.gold>=defaults.growth.levelUpCosts[hero.level-1]){botCommand(r,p,'LEVEL_UP',{ownedHeroInstanceId:hero.ownedHeroInstanceId});b.purchases++;continue;}
      const total=hero.powerEnhancements+hero.vitalityEnhancements;if(hero.level===5&&total<3&&p.gold>=defaults.growth.enhancementCosts[total]){botCommand(r,p,'ENHANCE_HERO',{ownedHeroInstanceId:hero.ownedHeroInstanceId,kind:HERO_BY_ID[hero.heroDefinitionId].role==='tank'?'vitality':'power'});b.purchases++;continue;}}
    if(r.phase==='INITIAL_MAINTENANCE')botCommand(r,p,'SET_READY',{ready:true});
    else if(r.tick>=p.redeployNotBeforeTick){const pair=choosePair(r,p);if(pair&&pair.lane!==p.selectedLane)botCommand(r,p,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:hero.ownedHeroInstanceId,lane:pair.lane});botCommand(r,p,'DEPLOY_HERO',{deathId:p.deathId});}
  }
}
function syncCombat(r:RoomData){
  if(!r.combat)return;for(const p of r.players){const s=r.combat.stats[p.playerId];if(s)Object.assign(p.stats,s);const cooldown=r.combat.cooldowns[p.playerId];if(cooldown){p.sharedSkillReadyAt={...cooldown.shared};for(const h of p.inventory)Object.assign(h.skillReadyAt,cooldown.instance[h.ownedHeroInstanceId]||{});}}
}
function finish(r:RoomData,winner:Team|'DRAW'|null,cancelled=false){
  syncCombat(r);r.result=makeResult(r.matchId!,winner,r.battleStartTick===null?0:(r.tick-r.battleStartTick)/20,r.players.map(p=>({playerId:p.playerId,name:p.name,team:p.team,isBot:p.isBot,stats:p.stats})),cancelled);
  for(const p of r.players){p.state='FINISHED';if(p.bot)p.bot.pendingAnswer=null;}phase(r,cancelled?'CANCELLED':'RESULT');r.paused=false;
}
export function tickRoom(r:RoomData){
  if(r.paused||['LOBBY','RESULT','CANCELLED'].includes(r.phase))return;
  r.tick++;tickBots(r);
  if(r.phase==='COUNTDOWN'&&r.tick>=r.countdownEndTick!){r.battleStartTick=r.tick;r.combat=createCombat(r.matchId!,r.seed,r.tick);phase(r,'BATTLE');for(const p of r.players){if(p.state==='READY')deploy(r,p);else p.state='DEAD_MAINTENANCE';p.quizAvailableAtTick=0;}return;}
  if(r.phase==='BATTLE'&&r.combat){const result=stepCombat(r.combat,r.tick);for(const death of result.deaths){const p=r.players.find(p=>p.playerId===death.playerId);if(p&&p.activeEntityId===death.entityId){p.activeEntityId=null;p.state='DEAD_MAINTENANCE';p.deathId=`death-${randomUUID()}`;p.redeployNotBeforeTick=r.tick+defaults.deployment.minimumDeadWaitSeconds*20;}}
    syncCombat(r);if(result.winner)finish(r,result.winner);}
}
export function snapshot(r:RoomData,actor:Actor,seq=0,includeBattle=true):RoomSnapshot{
  const p=r.players.find(x=>x.playerId===actor);
  const student=(p:Player):SelfState=>({playerId:p.playerId,gold:p.gold,inventory:p.inventory,selectedOwnedHeroId:p.selectedOwnedHeroId,selectedLane:p.selectedLane,starterChoiceUsed:p.starterChoiceUsed,hasDeployedThisMatch:p.hasDeployedThisMatch,deathId:p.deathId,redeployNotBeforeTick:p.redeployNotBeforeTick,quizAvailableAtTick:p.quizAvailableAtTick,quiz:publicQuiz(p.quizAttempt),ledgerRevision:p.ledgerRevision,stats:p.stats,sharedSkillReadyAt:p.sharedSkillReadyAt});
  return {protocolVersion:1,roomId:r.roomId,roomCode:r.roomCode,matchId:r.matchId,phase:r.phase,phaseRevision:r.phaseRevision,paused:r.paused,tick:r.tick,battleStartTick:r.battleStartTick,countdownEndTick:r.countdownEndTick,snapshotSeq:seq,quizBankCount:r.quizBank.length,connectionEpoch:actor==='host'?r.hostConnectionEpoch:p?.connectionEpoch||0,recovered:r.recovered,
    players:r.players.map(x=>{const h=x.inventory.find(h=>h.ownedHeroInstanceId===x.selectedOwnedHeroId);return {playerId:x.playerId,name:x.name,team:x.team,isBot:x.isBot,botProfile:x.isBot?x.botProfile:undefined,online:x.online,state:x.state,activeEntityId:x.activeEntityId,heroDefinitionId:h?.heroDefinitionId||null,level:h?.level||0,lane:x.selectedLane,quizProgress:x.quizAttempt?.index||0};}),
    self:p?student(p):null,...(actor==='host'?{hostStudents:r.players.map(student)}:{}),
    battle:includeBattle&&r.combat?{...r.combat,seed:0,stats:{},cooldowns:{},scheduled:[],units:r.combat.units.map(u=>({...u,skillReadyAt:{},damageLedger:[],supportLedger:[]})),structures:r.combat.structures.map(u=>({...u,skillReadyAt:{},damageLedger:[],supportLedger:[]}))}:null,result:r.result};
}
