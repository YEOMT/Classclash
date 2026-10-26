import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addPlayer,directCommand,type RoomData} from '../src/server/room.js';
import {HERO_BY_ID,heroStats} from '../src/shared/heroes.js';
import {BALANCE} from '../src/shared/balance.js';

function apply(r:RoomData,actor:string,type:string,payload:Record<string,unknown>={}){const result=directCommand(r,actor,type,payload);assert.equal(result.status,'APPLIED',`${type}: ${result.errorCode}`);return result;}
/** All test funds are earned through the real 20-question server grading path. */
function prepared(score:number){const r=createRoom('MONEY1','host',901,true),a=addPlayer(r,'경제 학생','a'),b=addPlayer(r,'상대 학생','b');apply(r,'host','START_OPENING_QUIZ');for(const p of[a,b])for(let i=0;i<20;i++){const q=p.quizAttempt!.items[p.quizAttempt!.index];apply(r,p.playerId,'SUBMIT_ANSWER',{attemptId:p.quizAttempt!.attemptId,questionId:q.id,optionId:p===a&&i<score?q.correctOptionId:q.options.find(o=>o.id!==q.correctOptionId)!.id});}assert.equal(r.phase,'INITIAL_MAINTENANCE');assert.equal(a.gold,score);apply(r,a.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});apply(r,b.playerId,'CLAIM_STARTER',{heroDefinitionId:'archer'});return{r,a,b};}
for(const[ticket,cost]of[['NORMAL',2],['PREMIUM',10]] as const)test(`G01/G02/G10 ${ticket}: exact earned price adds one independent stored hero and no active unit`,()=>{
 const{r,a}=prepared(cost),first=structuredClone(a.inventory[0]);apply(r,a.playerId,'DRAW_HERO',{ticketType:ticket,pool:'ALL'});assert.equal(a.gold,0);assert.equal(a.stats.spent,cost);assert.equal(a.inventory.length,2);assert.deepEqual(a.inventory[0],first);assert.notEqual(a.inventory[1].ownedHeroInstanceId,first.ownedHeroInstanceId);assert.equal(a.inventory[1].level,1);assert.equal(a.selectedOwnedHeroId,first.ownedHeroInstanceId);assert.equal(a.activeEntityId,null);assert.equal(r.combat,null);
});
test('G03: balances one below either ticket price reject without consuming RNG, wallet revision or inventory',()=>{
 for(const[ticket,balance]of[['NORMAL',1],['PREMIUM',9]] as const){const{r,a}=prepared(balance),before=structuredClone({gold:a.gold,ledger:a.ledgerRevision,inventory:a.inventory,draw:r.drawRng,stats:a.stats});const result=directCommand(r,a.playerId,'DRAW_HERO',{ticketType:ticket,pool:'ALL'});assert.equal(result.errorCode,'INSUFFICIENT_GOLD');assert.deepEqual({gold:a.gold,ledger:a.ledgerRevision,inventory:a.inventory,draw:r.drawRng,stats:a.stats},before);}
});
test('G11/G12: earned funds level one instance from1to5 at exact costs and never buy a sixth level or third skill',()=>{
 const{r,a}=prepared(20),hero=a.inventory[0];let expected=20;for(let level=2;level<=5;level++){apply(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:hero.ownedHeroInstanceId});expected-=BALANCE.growth.levelUpCosts[level-2];assert.equal(a.gold,expected);assert.equal(hero.level,level);const unlocked=HERO_BY_ID[hero.heroDefinitionId].skills.filter(skill=>skill.unlockLevel<=level);assert.equal(unlocked.length,level===5?2:1);for(const skill of unlocked)assert.equal(hero.skillReadyAt[skill.id],r.tick);}
 const before=structuredClone({gold:a.gold,revision:a.ledgerRevision,hero});assert.equal(directCommand(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:hero.ownedHeroInstanceId}).errorCode,'LEVEL_MAX');assert.deepEqual({gold:a.gold,revision:a.ledgerRevision,hero},before);assert.equal(HERO_BY_ID[hero.heroDefinitionId].skills.length,2);
});
test('G13/M08: all eight legal three-enhancement mixes obey costs, independent growth, exact stats and fourth-purchase cap',()=>{
 for(let mask=0;mask<8;mask++){const{r,a}=prepared(20);apply(r,a.playerId,'DRAW_HERO',{ticketType:'NORMAL',pool:'ALL'});const hero=a.inventory[0],other=structuredClone(a.inventory[1]);let expected=18,power=0,vitality=0;
  for(let i=0;i<3;i++){const kind=mask&(1<<i)?'power':'vitality';apply(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:hero.ownedHeroInstanceId,kind});kind==='power'?power++:vitality++;expected-=BALANCE.growth.enhancementCosts[i];assert.equal(a.gold,expected);assert.equal(hero.powerEnhancements,power);assert.equal(hero.vitalityEnhancements,vitality);assert.deepEqual(a.inventory[1],other);}
  const stats=heroStats('paladin',hero.level,hero.powerEnhancements,hero.vitalityEnhancements);assert.equal(stats.power,[44,47,49,52][power]);assert.equal(stats.hp,[850,918,986,1054][vitality]);const before=structuredClone({gold:a.gold,revision:a.ledgerRevision,hero});for(const kind of['power','vitality'])assert.equal(directCommand(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:hero.ownedHeroInstanceId,kind}).errorCode,'ENHANCEMENT_MAX');assert.deepEqual({gold:a.gold,revision:a.ledgerRevision,hero},before);
 }
});
test('G09/M11: invalid premium role and another participant hero cannot spend or change ownership',()=>{
 const{r,a,b}=prepared(20),before=structuredClone({gold:a.gold,revision:a.ledgerRevision,inventory:a.inventory,selected:a.selectedOwnedHeroId,lane:a.selectedLane}),other=b.inventory[0].ownedHeroInstanceId;
 for(const pool of['ranged','support'])assert.equal(directCommand(r,a.playerId,'DRAW_HERO',{ticketType:'PREMIUM',pool}).errorCode,'INVALID_DRAW_POOL');assert.equal(directCommand(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:other,kind:'power'}).errorCode,'HERO_NOT_OWNED');assert.equal(directCommand(r,a.playerId,'SELECT_HERO_AND_LANE',{ownedHeroInstanceId:other,lane:'BOTTOM'}).errorCode,'HERO_NOT_OWNED');assert.deepEqual({gold:a.gold,revision:a.ledgerRevision,inventory:a.inventory,selected:a.selectedOwnedHeroId,lane:a.selectedLane},before);
});
