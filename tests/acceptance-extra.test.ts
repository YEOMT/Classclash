import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,directCommand,tickRoom,type RoomData,type Player} from '../src/server/room.js';
import {HERO_BY_ID} from '../src/shared/heroes.js';
import {BALANCE} from '../src/shared/balance.js';
import {DEFAULT_BANK,newAttempt,simulatedOption} from '../src/server/quiz.js';
import {hash32,nextRandom} from '../src/shared/random.js';
import type {CombatUnit,Projectile,Source} from '../src/shared/combat-types.js';

function apply(r:RoomData,actor:string,type:string,payload:Record<string,unknown>={}) {
 const p=r.players.find(p=>p.playerId===actor);
 const reply=directCommand(r,actor,type,{...(p?.hasDeployedThisMatch&&p.state==='DEAD_MAINTENANCE'?{deathId:p.deathId}:{}),...payload});
 assert.equal(reply.status,'APPLIED',`${type}: ${reply.errorCode} ${reply.message}`);return reply;
}
function tick(r:RoomData,n:number){for(let i=0;i<n;i++)tickRoom(r);}
function answer(r:RoomData,p:Player,correct=true){const a=p.quizAttempt!,q=a.items[a.index];return apply(r,p.playerId,'SUBMIT_ANSWER',{attemptId:a.attemptId,questionId:q.id,optionId:correct?q.correctOptionId:q.options.find(o=>o.id!==q.correctOptionId)!.id});}
function prepared(score=20){const r=createRoom('EXTRA1','host',803,true),a=addPlayer(r,'시험 학생','a'),b=addPlayer(r,'상대 학생','b');apply(r,'host','START_OPENING_QUIZ');for(let i=0;i<20;i++){answer(r,a,i<score);answer(r,b);}for(const p of[a,b])apply(r,p.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});return{r,a,b};}
function begin(r:RoomData,players:Player[],allowUnready=false){for(const p of players)apply(r,p.playerId,'SET_READY',{ready:true});apply(r,'host','START_COUNTDOWN',{allowUnready});tick(r,100);assert.equal(r.phase,'BATTLE');}
function battle(){const x=prepared();begin(x.r,[x.a,x.b]);return x;}
function unit(r:RoomData,p:Player){const u=r.combat!.units.find(u=>u.entityId===p.activeEntityId);assert.ok(u);return u;}
/** A controlled lethal basic attack still uses the actual engine's hit/death/room transition. */
function kill(r:RoomData,p:Player,enemy:Player){const s=r.combat!,v=unit(r,p),u=unit(r,enemy);s.units=[v,u];s.structures=[];s.projectiles=[];s.effects=[];s.nextWaveTick=Number.MAX_SAFE_INTEGER;
 Object.assign(v,{lane:'TOP',x:600,y:224,hp:1,speed:0,createdTick:-100,nextBasicReadyTick:Number.MAX_SAFE_INTEGER,nextAiTick:r.tick,state:'HOLD',action:null,actionId:null,targetId:u.entityId,statuses:[],shields:[]});
 Object.assign(u,{lane:'TOP',x:600+v.radius+u.radius+4,y:224,hp:100000,maxHp:100000,power:10000,speed:0,createdTick:-100,nextBasicReadyTick:r.tick,nextAiTick:r.tick,state:'HOLD',action:null,actionId:null,targetId:v.entityId,statuses:[],shields:[]});
 for(const h of[v,u])for(const sk of HERO_BY_ID[h.heroDefinitionId!].skills)h.skillReadyAt[sk.id]=Number.MAX_SAFE_INTEGER;
 for(let i=0;i<20&&p.activeEntityId;i++)tickRoom(r);assert.equal(p.state,'DEAD_MAINTENANCE');assert.equal(p.activeEntityId,null);u.power=0;u.nextBasicReadyTick=Number.MAX_SAFE_INTEGER;
}
function stationaryDuel(r:RoomData,a:Player,b:Player){const u=unit(r,a),v=unit(r,b),s=r.combat!;s.units=[u,v];s.structures=[];s.nextWaveTick=Number.MAX_SAFE_INTEGER;
 // Durable target is fixture-only. Both actions and damage still resolve in the engine.
 Object.assign(u,{lane:'TOP',x:600,y:224,speed:0,createdTick:-100,nextAiTick:r.tick,state:'HOLD',targetId:v.entityId});
 Object.assign(v,{lane:'TOP',x:600+u.radius+v.radius+4,y:224,hp:100000,maxHp:100000,power:0,speed:0,createdTick:-100,nextAiTick:r.tick,state:'HOLD',targetId:u.entityId});return{u,v};
}

test('L12: an empty team and a team without READY both block start, including allowUnready',()=>{
 const r=createRoom('EMPTY1','host',804,true),a=addPlayer(r,'청팀 학생','a',{team:'A'});
 for(const count of[1,2]){if(count===2)addPlayer(r,'같은 팀원','a2',{team:'A'});const before={match:r.matchId,phase:r.phase,revision:r.phaseRevision};assert.equal(directCommand(r,'host','START_OPENING_QUIZ').errorCode,'ROSTER_NOT_READY');assert.deepEqual({match:r.matchId,phase:r.phase,revision:r.phaseRevision},before);}
 const b=addPlayer(r,'홍팀 학생','b',{team:'B'});apply(r,'host','START_OPENING_QUIZ');apply(r,'host','CLOSE_OPENING_QUIZ');apply(r,a.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});apply(r,a.playerId,'SET_READY',{ready:true});
 for(const allowUnready of[false,true])assert.equal(directCommand(r,'host','START_COUNTDOWN',{allowUnready}).errorCode,'ROSTER_NOT_READY');assert.equal(r.phase,'INITIAL_MAINTENANCE');assert.equal(r.combat,null);
 apply(r,b.playerId,'CLAIM_STARTER',{heroDefinitionId:'archer'});apply(r,b.playerId,'SET_READY',{ready:true});assert.equal(directCommand(r,'host','START_COUNTDOWN').errorCode,'ROSTER_NOT_READY');apply(r,'host','START_COUNTDOWN',{allowUnready:true});
});

test('L13: exactly two standard AI complete all 40 graded answers, choose and grow, then READY before host starts',()=>{
 const r=createRoom('TWOAI1','host',805,true);apply(r,'host','ADD_BOTS',{count:2,profile:'STANDARD'});apply(r,'host','START_OPENING_QUIZ');
 for(let i=0;i<6000&&!r.players.every(p=>p.state==='READY');i++)tickRoom(r);
 assert.equal(r.phase,'INITIAL_MAINTENANCE');assert.equal(r.combat,null);assert.ok(r.players.every(p=>p.state==='READY'));
 for(const p of r.players){assert.equal(p.stats.openingAnswered,20);assert.equal(p.stats.earned,p.stats.openingCorrect);assert.equal(p.gold+p.stats.spent,p.stats.earned);assert.equal(p.stats.deployments,0);assert.equal(p.starterChoiceUsed,true);assert.ok(p.inventory.some(h=>h.obtainedFrom==='STARTER'));assert.ok(p.selectedOwnedHeroId);}
 apply(r,'host','START_COUNTDOWN');tick(r,99);assert.equal(r.phase,'COUNTDOWN');assert.equal(r.combat,null);tickRoom(r);assert.equal(r.phase,'BATTLE');assert.equal(r.combat!.units.filter(u=>u.kind==='HERO').length,2);assert.equal(r.combat!.units.filter(u=>u.kind.endsWith('MINION')).length,42);assert.ok(r.players.every(p=>p.stats.deployments===1));
});

test('B05: 2000 wrong-intent choices across real shuffled items reach every distractor and never the answer',()=>{
 const shuffleRng={value:hash32('acceptance-shuffled-options')},choiceRng={value:hash32('acceptance-wrong-options')};const attempt=newAttempt(DEFAULT_BANK,'OPENING',[],()=>nextRandom(shuffleRng));const correctPositions=new Set<number>(),relativeCounts=[0,0,0];
 for(const item of attempt.items){const wrong=item.options.filter(o=>o.id!==item.correctOptionId),seen=new Set<string>();correctPositions.add(item.options.findIndex(o=>o.id===item.correctOptionId));assert.equal(simulatedOption(item,true,()=>nextRandom(choiceRng)),item.correctOptionId);
  for(let i=0;i<100;i++){const option=simulatedOption(item,false,()=>nextRandom(choiceRng)),index=wrong.findIndex(o=>o.id===option);assert.notEqual(option,item.correctOptionId);assert.ok(index>=0);seen.add(option);relativeCounts[index]++;}assert.equal(seen.size,3,'all three displayed distractors must be selectable');
 }
 assert.equal(correctPositions.size,4,'the production shuffle must exercise all correct-answer display positions');assert.equal(relativeCounts.reduce((a,b)=>a+b),2000);for(const n of relativeCounts)assert.ok(Math.abs(n/2000-1/3)<.04,`distractor share ${n}/2000`);
});

test('Q04: 0, 1, 10 and 20 correct answers earn exact assets; every score retains the free starter',()=>{
 for(const score of[0,1,10,20]){const {r,a}=prepared(score);assert.equal(r.phase,'INITIAL_MAINTENANCE');assert.equal(a.gold,score);assert.equal(a.stats.earned,score);assert.equal(a.stats.openingCorrect,score);assert.equal(a.stats.openingAnswered,20);assert.equal(a.stats.spent,0);assert.equal(a.inventory.length,1);assert.equal(a.inventory[0].obtainedFrom,'STARTER');assert.equal(a.inventory[0].level,1);assert.equal(a.activeEntityId,null);}
});

test('Q12: one minute without answering leaves assets and attempt unchanged while real attacks continue',()=>{
 const {r,a,b}=battle();const {u,v}=stationaryDuel(r,a,b);apply(r,a.playerId,'START_QUIZ');const before={gold:a.gold,earned:a.stats.earned,attempt:structuredClone(a.quizAttempt),tick:r.tick,eventSeq:r.combat!.eventSeq,targetHp:v.hp};tick(r,1200);
 assert.equal(r.tick,before.tick+1200);assert.equal(a.gold,before.gold);assert.equal(a.stats.earned,before.earned);assert.deepEqual(a.quizAttempt,before.attempt);assert.equal(a.activeEntityId,u.entityId);assert.ok(v.hp<before.targetHp,'actual basic attacks must resolve during the unanswered question');assert.ok(r.combat!.eventSeq>before.eventSeq);assert.ok(a.stats.heroDamage>0);
});

test('B08/B12: active AI cannot buy or swap, and bot profile never changes identical automatic combat',()=>{
 const {r,a}=battle();const baseline=structuredClone(r);
 for(const profile of['BASIC','STANDARD','SKILLED'] as const){const copy=structuredClone(baseline),p=copy.players.find(p=>p.playerId===a.playerId)!;const fixture=createRoom('BOTDEF','host',1,true);const bot=addPlayer(fixture,'봇 상태','unused',{bot:true,profile});p.isBot=true;p.botProfile=profile;p.bot=structuredClone(bot.bot);
  const original={gold:p.gold,inventory:structuredClone(p.inventory),selected:p.selectedOwnedHeroId};for(const type of['DRAW_HERO','LEVEL_UP','ENHANCE_HERO','SELECT_HERO_AND_LANE','DEPLOY_HERO'])assert.equal(directCommand(copy,p.playerId,type,{}).errorCode,'HERO_ALREADY_ACTIVE');assert.deepEqual({gold:p.gold,inventory:p.inventory,selected:p.selectedOwnedHeroId},original);
  const human=structuredClone(baseline);tick(copy,100);tick(human,100);assert.deepEqual(copy.combat,human.combat,`${profile} may change quiz decisions but not combat stats/actions`);
 }
});

test('M07/M09: actual death and A→B→A deployments restore each owned hero growth and full HP',()=>{
 const {r,a,b}=prepared();const first=a.inventory[0];apply(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:first.ownedHeroInstanceId});apply(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:first.ownedHeroInstanceId,kind:'vitality'});apply(r,a.playerId,'DRAW_HERO',{ticketType:'NORMAL',pool:'ranged'});const second=a.inventory[1];
 apply(r,a.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:first.ownedHeroInstanceId,lane:'TOP'});begin(r,[a,b]);const firstNumbers={maxHp:unit(r,a).maxHp,power:unit(r,a).power,level:unit(r,a).level};kill(r,a,b);tick(r,BALANCE.deployment.minimumDeadWaitSeconds*20);
 apply(r,a.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:second.ownedHeroInstanceId,lane:'BOTTOM'});apply(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:second.ownedHeroInstanceId});apply(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:second.ownedHeroInstanceId,kind:'power'});apply(r,a.playerId,'DEPLOY_HERO');const secondNumbers={maxHp:unit(r,a).maxHp,power:unit(r,a).power,level:unit(r,a).level};assert.equal(unit(r,a).hp,secondNumbers.maxHp);
 kill(r,a,b);tick(r,BALANCE.deployment.minimumDeadWaitSeconds*20);apply(r,a.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:first.ownedHeroInstanceId,lane:'TOP'});apply(r,a.playerId,'DEPLOY_HERO');const restored=unit(r,a);assert.deepEqual({maxHp:restored.maxHp,power:restored.power,level:restored.level},firstNumbers);assert.equal(restored.hp,firstNumbers.maxHp);assert.equal(restored.ownedHeroInstanceId,first.ownedHeroInstanceId);assert.equal(first.vitalityEnhancements,1);assert.equal(first.powerEnhancements,0);assert.equal(second.vitalityEnhancements,0);assert.equal(second.powerEnhancements,1);assert.equal(a.stats.deployments,3);assert.equal(a.stats.deaths,2);
});

test('B07: an AI starts its next real quiz no earlier than 600 ticks after answer ten',()=>{
 const {r,a,b}=battle();stationaryDuel(r,a,b);const fixture=createRoom('BOTQUI','host',1,true),bot=addPlayer(fixture,'자동 응답','unused',{bot:true,profile:'SKILLED'});a.isBot=true;a.botProfile='SKILLED';a.bot=structuredClone(bot.bot);
 for(let i=0;i<800&&a.stats.answered<30;i++)tickRoom(r);assert.equal(a.stats.answered,30);const completed=a.quizAttempt!.attemptId,at=r.tick;assert.equal(a.quizAttempt!.completed,true);assert.equal(a.quizAvailableAtTick,at+600);
 tick(r,599);assert.equal(a.quizAttempt!.attemptId,completed);assert.equal(a.stats.answered,30);tickRoom(r);assert.notEqual(a.quizAttempt!.attemptId,completed);assert.equal(a.quizAttempt!.kind,'BATTLE');assert.equal(a.quizAttempt!.index,0);assert.equal(a.stats.answered,30);
});

test('B09: a zero-asset AI returns with its existing free hero after a real death without shopping forever',()=>{
 const {r,a,b}=prepared(0);begin(r,[a,b]);const ownedId=a.inventory[0].ownedHeroInstanceId;kill(r,a,b);const deathTick=r.tick;const fixture=createRoom('ZEROBOT','host',1,true),bot=addPlayer(fixture,'무자산 봇','unused',{bot:true,profile:'STANDARD'});a.isBot=true;a.bot=structuredClone(bot.bot);
 for(let i=0;i<BALANCE.deployment.minimumDeadWaitSeconds*20+100&&!a.activeEntityId;i++)tickRoom(r);assert.ok(a.activeEntityId,'existing hero deployment must not require a purchase');assert.ok(r.tick>=deathTick+BALANCE.deployment.minimumDeadWaitSeconds*20);assert.equal(a.stats.deployments,2);assert.equal(a.stats.deaths,1);assert.equal(a.gold,0);assert.equal(a.stats.earned,0);assert.equal(a.stats.spent,0);assert.equal(a.inventory.length,1);assert.equal(unit(r,a).ownedHeroInstanceId,ownedId);assert.equal(unit(r,a).hp,unit(r,a).maxHp);
});

test('R03: 13 minutes of real server ticks with unequal surviving nexus HP never creates a time-limit winner',()=>{
 const {r,a,b}=battle(),s=r.combat!;s.units=[unit(r,a),unit(r,b)];s.nextWaveTick=Number.MAX_SAFE_INTEGER;for(const u of s.units){u.speed=0;u.nextBasicReadyTick=Number.MAX_SAFE_INTEGER;}const nexus=s.structures.filter(u=>u.kind==='NEXUS');nexus[0].hp=Math.floor(nexus[0].maxHp/2);const hp=nexus.map(u=>u.hp);tick(r,781*20);
 assert.equal((r.tick-r.battleStartTick!)/20,781);assert.equal(r.phase,'BATTLE');assert.equal(r.result,null);assert.equal(s.winner,null);assert.deepEqual(nexus.map(u=>u.hp),hp);assert.ok(hp[0]!==hp[1]);
});

test('late unready AI takes its legal first maintenance path without a fabricated death or lost opening assets',()=>{
 const r=createRoom('LATEAI','host',806,true),a=addPlayer(r,'먼저 준비','a'),b=addPlayer(r,'상대 준비','b'),late=addPlayer(r,'늦은 봇','bot',{bot:true,profile:'STANDARD'});apply(r,'host','START_OPENING_QUIZ');for(let i=0;i<20;i++)for(const p of[a,b,late])answer(r,p);for(const p of[a,b])apply(r,p.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});late.bot!.nextDecisionTick=1000;begin(r,[a,b],true);
 assert.equal(late.state,'DEAD_MAINTENANCE');assert.equal(late.deathId,null);assert.equal(late.hasDeployedThisMatch,false);assert.equal(late.gold,20);late.bot!.nextDecisionTick=r.tick;for(let i=0;i<500&&!late.hasDeployedThisMatch;i++)tickRoom(r);
 assert.equal(late.hasDeployedThisMatch,true);assert.equal(late.stats.deployments,1);assert.equal(late.stats.deaths,0);assert.equal(late.deathId,null);assert.ok(late.inventory.some(h=>h.obtainedFrom==='STARTER'));assert.equal(late.gold+late.stats.spent,late.stats.earned);assert.ok(late.activeEntityId);
});

test('R03/R05: simultaneous actual projectile nexus kills make one DRAW ceremony and freeze all late student mutations',()=>{
 const {r,a,b}=battle();const s=r.combat!;apply(r,a.playerId,'START_QUIZ');const quiz=a.quizAttempt!,question=quiz.items[0];s.units=s.units.filter(u=>u.kind==='HERO');s.nextWaveTick=Number.MAX_SAFE_INTEGER;
 const nexuses=s.structures.filter(u=>u.kind==='NEXUS');for(const structure of s.structures){structure.hp=structure.kind==='NEXUS'?1:0;structure.protected=false;structure.nextBasicReadyTick=Number.MAX_SAFE_INTEGER;}
 function bolt(target:CombatUnit):Projectile{const attacker=unit(r,target.team==='A'?b:a);const source:Source={entityId:attacker.entityId,deploymentId:attacker.deploymentId,playerId:attacker.ownerPlayerId,ownedHeroInstanceId:attacker.ownedHeroInstanceId,heroDefinitionId:attacker.heroDefinitionId,team:attacker.team,kind:'HERO',power:1000,maxHp:attacker.maxHp};return{entityId:`fixture-bolt-${target.team}`,source,targetId:target.entityId,lastTarget:{x:target.x,y:target.y},direction:{x:target.team==='A'?-1:1,y:0},x:target.x,y:target.y,speed:400,radius:3,remaining:200,createdTick:r.tick-1,effectId:'arrow',actionId:`fixture-shot-${target.team}`,mode:'HOMING',maxTargets:1,hitIds:[],payload:{skillId:null,coefficient:1,structureMultiplier:1},falloff:0,minFalloff:0};}
 s.projectiles=nexuses.map(bolt);tickRoom(r);assert.equal(r.phase,'RESULT');assert.equal(r.result!.winner,'DRAW');assert.equal(r.result!.cancelled,false);assert.equal(nexuses.filter(n=>n.hp===0).length,2);assert.equal(r.result!.awards.length,7);assert.ok(r.result!.awards.every(x=>!x.aiOnly));assert.equal(s.metrics.destroyed.filter(d=>d.kind==='NEXUS').length,2);
 const before=structuredClone({tick:r.tick,result:r.result,players:r.players,combat:r.combat});const ownedHeroInstanceId=a.inventory[0].ownedHeroInstanceId;const requests:[string,Record<string,unknown>][]=[['START_QUIZ',{}],['RESUME_QUIZ',{}],['SUBMIT_ANSWER',{attemptId:quiz.attemptId,questionId:question.id,optionId:question.correctOptionId}],['DRAW_HERO',{ticketType:'NORMAL',pool:'ALL'}],['LEVEL_UP',{ownedHeroInstanceId}],['ENHANCE_HERO',{ownedHeroInstanceId,kind:'power'}],['SELECT_HERO_AND_LANE',{ownedHeroInstanceId,lane:'BOTTOM'}],['DEPLOY_HERO',{}],['SET_READY',{ready:true}]];
 for(const[type,payload]of requests)assert.equal(directCommand(r,a.playerId,type,payload).status,'REJECTED',type);tick(r,1000);assert.deepEqual({tick:r.tick,result:r.result,players:r.players,combat:r.combat},before);
});
