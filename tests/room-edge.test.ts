import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,directCommand,command,tickRoom,snapshot,type RoomData,type Player} from '../src/server/room.js';
import {HERO_BY_ID} from '../src/shared/heroes.js';
import {BALANCE} from '../src/shared/balance.js';
import type {ClientCommand} from '../src/shared/types.js';

const apply=(r:RoomData,actor:string,type:string,payload:Record<string,unknown>={})=>{const p=r.players.find(p=>p.playerId===actor);const res=directCommand(r,actor,type,{...(p?.hasDeployedThisMatch&&p.state==='DEAD_MAINTENANCE'?{deathId:p.deathId}:{}),...payload});assert.equal(res.status,'APPLIED',`${type}: ${res.errorCode}`);return res;};
const waitTicks=BALANCE.deployment.minimumDeadWaitSeconds*20;
function tick(r:RoomData,n:number){for(let i=0;i<n;i++)tickRoom(r);}
function answer(r:RoomData,p:Player,id?:string){const a=p.quizAttempt!,q=a.items[a.index],payload={attemptId:a.attemptId,questionId:q.id,optionId:q.correctOptionId};const res=directCommand(r,p.playerId,'SUBMIT_ANSWER',payload,id);assert.equal(res.status,'APPLIED');return {payload,res};}
function prepared(extra=false){const r=createRoom('EDGE01','host',77,true),a=addPlayer(r,'학생 하나','a'),b=addPlayer(r,'학생 둘둘','b'),late=extra?addPlayer(r,'늦은 학생','c'):undefined;apply(r,'host','START_OPENING_QUIZ');for(let i=0;i<20;i++){answer(r,a);answer(r,b);if(late)answer(r,late);}for(const p of[a,b])apply(r,p.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});return{r,a,b,late};}
function begin(r:RoomData,players:Player[],allowUnready=false){for(const p of players)apply(r,p.playerId,'SET_READY',{ready:true});apply(r,'host','START_COUNTDOWN',{allowUnready});tick(r,100);assert.equal(r.phase,'BATTLE');}
function battle(){const x=prepared();begin(x.r,[x.a,x.b]);return x;}
/** Real engine lethal attack, using controlled combat positions/stats only in this test fixture. */
function killActive(r:RoomData,p:Player,enemy:Player){const s=r.combat!,victim=s.units.find(u=>u.entityId===p.activeEntityId)!,attacker=s.units.find(u=>u.entityId===enemy.activeEntityId)!;assert.ok(victim&&attacker);s.units=[victim,attacker];s.structures=[];s.nextWaveTick=Number.MAX_SAFE_INTEGER;s.projectiles=[];s.effects=[];
 Object.assign(victim,{lane:'TOP',x:600,y:224,previousX:600,previousY:224,hp:1,speed:0,createdTick:-100,nextBasicReadyTick:Number.MAX_SAFE_INTEGER,nextAiTick:r.tick,state:'HOLD',action:null,actionId:null,targetId:attacker.entityId,statuses:[],shields:[]});
 Object.assign(attacker,{lane:'TOP',x:600+victim.radius+attacker.radius+4,y:224,hp:100000,maxHp:100000,power:10000,speed:0,createdTick:-100,nextBasicReadyTick:r.tick,nextAiTick:r.tick,state:'HOLD',action:null,actionId:null,targetId:victim.entityId,statuses:[]});
 for(const u of[victim,attacker])for(const sk of HERO_BY_ID[u.heroDefinitionId!].skills)u.skillReadyAt[sk.id]=Number.MAX_SAFE_INTEGER;
 for(let i=0;i<20&&p.activeEntityId;i++)tickRoom(r);assert.equal(p.activeEntityId,null);assert.equal(p.state,'DEAD_MAINTENANCE');assert.ok(p.deathId);attacker.nextBasicReadyTick=Number.MAX_SAFE_INTEGER;attacker.power=0;return victim;
}
const envelope=(r:RoomData,p:Player,type:string,payload:Record<string,unknown>,commandId:string):ClientCommand=>({commandId,type,payload,matchId:r.matchId,expectedPhaseRevision:r.phaseRevision,connectionEpoch:p.connectionEpoch,ledgerRevision:p.ledgerRevision});

test('F14/Q10/COM-034: seventh-question death preserves attempt; resume and duplicate answer pay once',()=>{
 const {r,a,b}=battle();apply(r,a.playerId,'START_QUIZ');for(let i=0;i<6;i++)answer(r,a);const before=structuredClone(a.quizAttempt),gold=a.gold;
 killActive(r,a,b);assert.equal(a.quizAttempt!.attemptId,before!.attemptId);assert.equal(a.quizAttempt!.index,6);assert.equal(a.gold,gold);
 const self=snapshot(r,a.playerId).self!;assert.equal(self.quiz!.question!.id,before!.items[6].id);assert.equal(self.deathId,a.deathId);apply(r,a.playerId,'RESUME_QUIZ');assert.equal(a.quizAttempt!.index,6);
 const {payload}=answer(r,a,'seventh-question-after-death');for(let n=0;n<3;n++)assert.equal(directCommand(r,a.playerId,'SUBMIT_ANSWER',payload,'seventh-question-after-death').status,'REPLAYED');assert.equal(a.gold,gold+1);assert.equal(a.quizAttempt!.index,7);
 for(let i=7;i<10;i++)answer(r,a);assert.equal(a.quizAttempt!.completed,true);assert.equal(a.quizAvailableAtTick,r.tick+600);assert.equal(a.state,'DEAD_MAINTENANCE');assert.equal(a.activeEntityId,null);
});
test('COM-033/041: no human automatic respawn after 30s; configured wait boundary and maintenance remain legal',()=>{
 const {r,a,b}=battle();killActive(r,a,b);const death=a.deathId,at=r.tick;assert.equal(directCommand(r,a.playerId,'DEPLOY_HERO',{deathId:death}).errorCode,'REDEPLOY_WAIT');
 apply(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:a.inventory[0].ownedHeroInstanceId});tick(r,waitTicks-1);assert.equal(r.tick,at+waitTicks-1);assert.equal(directCommand(r,a.playerId,'DEPLOY_HERO',{deathId:death}).errorCode,'REDEPLOY_WAIT');tick(r,Math.max(2,602-waitTicks));
 assert.equal(a.activeEntityId,null);assert.equal(a.state,'DEAD_MAINTENANCE');assert.equal(a.stats.deployments,1);assert.equal(a.stats.deaths,1);
 apply(r,a.playerId,'DEPLOY_HERO',{deathId:death});assert.ok(a.activeEntityId);assert.equal(a.stats.deployments,2);
});
test('allowUnready first deployment preserves earned gold and starter without a false death or redeploy wait',()=>{
 const {r,a,b,late}=prepared(true);begin(r,[a,b],true);const p=late!;assert.equal(p.state,'DEAD_MAINTENANCE');assert.equal(p.hasDeployedThisMatch,false);assert.equal(p.deathId,null);assert.equal(p.stats.deaths,0);assert.equal(p.gold,20);
 const opening=p.quizAttempt!.attemptId;apply(r,p.playerId,'CLAIM_STARTER',{heroDefinitionId:'archer'});assert.equal(p.gold,20);assert.equal(p.quizAttempt!.attemptId,opening);apply(r,p.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:p.inventory[0].ownedHeroInstanceId,lane:'BOTTOM'});apply(r,p.playerId,'DEPLOY_HERO',{deathId:null});assert.equal(p.hasDeployedThisMatch,true);assert.equal(p.stats.deployments,1);assert.equal(p.stats.deaths,0);assert.equal(r.combat!.units.find(u=>u.entityId===p.activeEntityId)!.lane,'BOTTOM');
 assert.equal(directCommand(r,p.playerId,'CLAIM_STARTER',{heroDefinitionId:'priest'}).errorCode,'HERO_ALREADY_ACTIVE');
});
test('COM-005: four identical deployments replay one entity/deployment; different IDs cannot double summon',()=>{
 const {r,a,b}=battle();killActive(r,a,b);tick(r,waitTicks);const c=envelope(r,a,'DEPLOY_HERO',{deathId:a.deathId},'four-identical-deployments');const first=command(r,a.playerId,c);assert.equal(first.status,'APPLIED');for(let i=0;i<3;i++){const result=command(r,a.playerId,c);assert.equal(result.status,'REPLAYED');assert.deepEqual(result.publicResult,first.publicResult);}assert.equal(r.combat!.units.filter(u=>u.ownerPlayerId===a.playerId&&u.hp>0).length,1);assert.equal(a.stats.deployments,2);
 assert.equal(command(r,a.playerId,{...c,commandId:'different-id-same-generation'}).errorCode,'HERO_ALREADY_ACTIVE');
});
test('death generation rejects delayed previous-life and missing-generation deployment requests',()=>{
 const {r,a,b}=battle();killActive(r,a,b);const oldDeath=a.deathId;tick(r,waitTicks);apply(r,a.playerId,'DEPLOY_HERO',{deathId:oldDeath});killActive(r,a,b);assert.notEqual(a.deathId,oldDeath);tick(r,waitTicks);
 const old=directCommand(r,a.playerId,'DEPLOY_HERO',{deathId:oldDeath});assert.equal(old.status,'REJECTED');assert.equal(a.activeEntityId,null);
 const missing=directCommand(r,a.playerId,'DEPLOY_HERO',{});assert.equal(missing.status,'REJECTED','a request with no death generation must not affect a newer life');assert.equal(a.activeEntityId,null);
 apply(r,a.playerId,'DEPLOY_HERO',{deathId:a.deathId});
});
test('death generation guards every maintenance mutation before spending or changing a selected hero',()=>{
 const {r,a,b}=battle();killActive(r,a,b);tick(r,waitTicks);const before={gold:a.gold,revision:a.ledgerRevision,inventory:structuredClone(a.inventory),selected:a.selectedOwnedHeroId,lane:a.selectedLane},ownedHeroInstanceId=a.inventory[0].ownedHeroInstanceId;
 const requests:[string,Record<string,unknown>][]=[['DRAW_HERO',{ticketType:'NORMAL',pool:'ALL'}],['LEVEL_UP',{ownedHeroInstanceId}],['ENHANCE_HERO',{ownedHeroInstanceId,kind:'power'}],['SELECT_HERO_AND_LANE',{ownedHeroInstanceId,lane:'BOTTOM'}],['DEPLOY_HERO',{}]];
 for(const[type,payload]of requests)for(const generation of[{}, {deathId:'death-from-a-previous-life'}]){const res=directCommand(r,a.playerId,type,{...payload,...generation});assert.equal(res.status,'REJECTED',type);assert.equal(res.errorCode,'INVALID_PHASE',type);}
 assert.deepEqual({gold:a.gold,revision:a.ledgerRevision,inventory:a.inventory,selected:a.selectedOwnedHeroId,lane:a.selectedLane},before);assert.equal(a.activeEntityId,null);
});
test('Q11: redeploying during an unfinished quiz preserves its exact next question and reward ledger',()=>{
 const {r,a,b}=battle();apply(r,a.playerId,'START_QUIZ');for(let i=0;i<6;i++)answer(r,a);killActive(r,a,b);tick(r,waitTicks);const before=structuredClone(a.quizAttempt),gold=a.gold;apply(r,a.playerId,'DEPLOY_HERO',{deathId:a.deathId});assert.deepEqual(a.quizAttempt,before);assert.equal(a.gold,gold);assert.equal(a.state,'ACTIVE');answer(r,a);assert.equal(a.quizAttempt!.index,7);assert.equal(a.gold,gold+1);assert.ok(a.activeEntityId);
});
test('replaying an old starter ACK returns the original immutable hero result after later growth',()=>{
 const {r,a}=prepared();apply(r,a.playerId,'DRAW_HERO',{ticketType:'NORMAL',pool:'tank'});const id='immutable-owned-hero-response',h=a.inventory[0];const c=envelope(r,a,'LEVEL_UP',{ownedHeroInstanceId:h.ownedHeroInstanceId},id),first=command(r,a.playerId,c);assert.equal(first.status,'APPLIED');const original=structuredClone(first.publicResult);apply(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:h.ownedHeroInstanceId});apply(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:h.ownedHeroInstanceId,kind:'vitality'});const replay=command(r,a.playerId,c);assert.equal(replay.status,'REPLAYED');assert.deepEqual(replay.publicResult,original);
});
test('COM-026: same-type duplicate swap retains server skill cooldown and independent growth',()=>{
 const {r,a,b,late}=prepared(true),original=a.inventory[0];
 // Fixed inventory fixture isolates swapping a 22s skill from the separate draw/growth tests.
 Object.assign(original,{heroDefinitionId:'guardian_spirit',rarity:'LEGENDARY',level:5,powerEnhancements:1});const duplicate={...structuredClone(original),ownedHeroInstanceId:'owned-guardian-duplicate',powerEnhancements:0};a.inventory.push(duplicate);apply(r,late!.playerId,'CLAIM_STARTER',{heroDefinitionId:'priest'});begin(r,[a,b,late!]);
 const s=r.combat!,u=s.units.find(x=>x.entityId===a.activeEntityId)!,enemy=s.units.find(x=>x.entityId===b.activeEntityId)!,ally=s.units.find(x=>x.entityId===late!.activeEntityId)!;s.units=[u,enemy,ally];s.structures=[];s.nextWaveTick=Number.MAX_SAFE_INTEGER;
 Object.assign(u,{lane:'TOP',x:600,y:224,speed:0,hp:u.maxHp*.4,createdTick:-100,nextAiTick:r.tick,nextBasicReadyTick:Number.MAX_SAFE_INTEGER,targetId:enemy.entityId});Object.assign(enemy,{lane:'TOP',x:650,y:224,speed:0,hp:100000,maxHp:100000,createdTick:-100,nextAiTick:Number.MAX_SAFE_INTEGER,nextBasicReadyTick:Number.MAX_SAFE_INTEGER,targetId:u.entityId});Object.assign(ally,{lane:'TOP',x:590,y:194,speed:0,hp:ally.maxHp*.4,createdTick:-100,nextAiTick:Number.MAX_SAFE_INTEGER,nextBasicReadyTick:Number.MAX_SAFE_INTEGER,targetId:enemy.entityId});u.skillReadyAt['guardian_spirit.soul_guard']=Number.MAX_SAFE_INTEGER;
 tick(r,1);assert.equal(u.action?.skillId,'guardian_spirit.guardian_barrier');const ready=u.skillReadyAt['guardian_spirit.guardian_barrier'];assert.equal(a.sharedSkillReadyAt['guardian_spirit.guardian_barrier'],ready);killActive(r,a,b);tick(r,waitTicks);assert.ok(r.tick<ready,'the real cast cooldown must still be active for this regression');apply(r,a.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:duplicate.ownedHeroInstanceId,lane:'BOTTOM'});apply(r,a.playerId,'DEPLOY_HERO',{deathId:a.deathId});const replacement=s.units.find(x=>x.entityId===a.activeEntityId)!;
 assert.equal(replacement.skillReadyAt['guardian_spirit.guardian_barrier'],ready);assert.equal(replacement.level,5);assert.equal(original.powerEnhancements,1);assert.equal(duplicate.powerEnhancements,0);assert.notEqual(replacement.ownedHeroInstanceId,original.ownedHeroInstanceId);assert.equal(replacement.lane,'BOTTOM');
});
test('host closing opening quiz cancels bot pending answers without new rewards or ghost bot requests',()=>{
 const r=createRoom('BOTS01','host',17,true);apply(r,'host','ADD_BOTS',{count:2});apply(r,'host','START_OPENING_QUIZ');tick(r,1);const bot=r.players[0];assert.ok(bot.bot!.pendingAnswer);const pending=structuredClone(bot.bot!.pendingAnswer!);apply(r,'host','CLOSE_OPENING_QUIZ');assert.equal(bot.bot!.pendingAnswer,null);const gold=bot.gold;assert.equal(directCommand(r,bot.playerId,'SUBMIT_ANSWER',pending).status,'REJECTED');assert.equal(bot.gold,gold);apply(r,'host','CANCEL_MATCH');apply(r,'host','REMATCH_TO_LOBBY');apply(r,'host','REMOVE_BOT',{playerId:bot.playerId});assert.equal(directCommand(r,bot.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'}).errorCode,'NOT_AUTHORIZED');
});
test('B14/Q15: bot reservations, full answer key, future random streams and session hashes stay off both public views',()=>{
 const r=createRoom('HIDE01','host-private-hash',17,true),human=addPlayer(r,'검사 학생','human-private-hash');apply(r,'host','ADD_BOTS',{count:1});apply(r,'host','START_OPENING_QUIZ');tick(r,1);const bot=r.players.find(p=>p.isBot)!;assert.ok(bot.bot!.pendingAnswer);
 const host=snapshot(r,'host'),student=snapshot(r,human.playerId),botView=host.hostStudents!.find(p=>p.playerId===bot.playerId)!;
 for(const value of[JSON.stringify(host),JSON.stringify(student)])for(const secret of['correctOptionId','sessionHash','pendingAnswer','quizAccuracy','host-private-hash','human-private-hash',bot.quizAttempt!.items[1].id])assert.ok(!value.includes(secret),`disclosed private field or future question ${secret}`);
 assert.equal(student.hostStudents,undefined);assert.ok(!JSON.stringify(student).includes(bot.bot!.pendingAnswer!.optionId));
 // A read-only host may see the four current options, including whichever one the bot will choose,
 // but receives no field identifying that scheduled choice or its timing.
 assert.deepEqual(botView,snapshot(r,bot.playerId).self);assert.equal(botView.quiz!.question!.options.length,4);assert.ok(botView.quiz!.question!.options.some(o=>o.id===bot.bot!.pendingAnswer!.optionId));assert.equal(Object.hasOwn(botView.quiz!,'scheduledAnswer'),false);
 const before=structuredClone({gold:bot.gold,quiz:bot.quizAttempt,inventory:bot.inventory});assert.equal(directCommand(r,'host','SUBMIT_ANSWER',{playerId:bot.playerId,...bot.bot!.pendingAnswer}).errorCode,'NOT_AUTHORIZED');assert.deepEqual({gold:bot.gold,quiz:bot.quizAttempt,inventory:bot.inventory},before);
});
test('Q14/R05: late quiz answer after final result cannot change wallet, stats or awards',()=>{
 const {r,a}=battle();apply(r,a.playerId,'START_QUIZ');const quiz=a.quizAttempt!,q=quiz.items[quiz.index],payload={attemptId:quiz.attemptId,questionId:q.id,optionId:q.correctOptionId};apply(r,'host','CANCEL_MATCH');const before=structuredClone({gold:a.gold,stats:a.stats,result:r.result});assert.equal(directCommand(r,a.playerId,'SUBMIT_ANSWER',payload).status,'REJECTED');tick(r,20);assert.deepEqual({gold:a.gold,stats:a.stats,result:r.result},before);
});
