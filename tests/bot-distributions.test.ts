import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,directCommand,tickRoom,drawDefinition,type RoomData} from '../src/server/room.js';
import {BALANCE} from '../src/shared/balance.js';
import {HEROES} from '../src/shared/heroes.js';
import {hash32,nextRandom} from '../src/shared/random.js';
import type {BotProfile} from '../src/shared/types.js';

type Planned={playerId:string;index:number;question:string;correct:boolean;delayTicks:number;submitAtTick:number;optionIndex:number};
function opening(profile:BotProfile,seed:number):{room:RoomData;plans:Planned[]}{
 const room=createRoom('BOTDIST','host',seed,true);assert.equal(directCommand(room,'host','ADD_BOTS',{count:30,profile}).status,'APPLIED');assert.equal(directCommand(room,'host','START_OPENING_QUIZ',{seed}).status,'APPLIED');const seen=new Set<string>(),plans:Planned[]=[];
 for(let ticks=0;room.phase==='OPENING_QUIZ';ticks++){
  assert.ok(ticks<3000,'opening managers stalled');tickRoom(room);
  for(const p of room.players){const pending=p.bot!.pendingAnswer;if(!pending||seen.has(pending.questionId))continue;seen.add(pending.questionId);const attempt=p.quizAttempt!,q=attempt.items[attempt.index];assert.equal(q.id,pending.questionId);assert.equal(pending.attemptId,attempt.attemptId);const optionIndex=q.options.findIndex(o=>o.id===pending.optionId);assert.ok(optionIndex>=0);plans.push({playerId:p.playerId,index:attempt.index,question:q.questionId,correct:pending.optionId===q.correctOptionId,delayTicks:pending.at-room.tick,submitAtTick:pending.at,optionIndex});}
 }
 assert.equal(plans.length,600);assert.equal(room.players.reduce((sum,p)=>sum+p.stats.openingAnswered,0),600);assert.equal(room.players.reduce((sum,p)=>sum+p.stats.openingCorrect,0),plans.filter(p=>p.correct).length);
 for(const p of room.players){assert.equal(p.stats.earned,p.stats.correct);assert.equal(p.gold+p.stats.spent,p.stats.correct);assert.equal(p.stats.deployments,0);}
 return{room,plans};
}
for(const profile of ['BASIC','STANDARD','SKILLED'] as const)test(`B03/B04 ${profile}: actual managers schedule and submit 10,200 answers within rate and delay gates`,t=>{
 const definition=BALANCE.bots[profile],plans:Planned[]=[];for(let n=0;n<17;n++)plans.push(...opening(profile,21001+n).plans);assert.equal(plans.length,10200);
 const correct=plans.filter(p=>p.correct).length,rate=correct/plans.length;assert.ok(Math.abs(rate-definition.correctProbability)<=.02,`${profile} correct rate ${rate}`);
 const minimumTicks=Math.ceil(definition.answerSeconds[0]*20),maximumTicks=Math.ceil(definition.answerSeconds[1]*20);assert.ok(plans.every(p=>Number.isInteger(p.delayTicks)&&p.delayTicks>=minimumTicks&&p.delayTicks<=maximumTicks));
 const mean=plans.reduce((sum,p)=>sum+p.delayTicks/20,0)/plans.length,midpoint=(definition.answerSeconds[0]+definition.answerSeconds[1])/2;assert.ok(Math.abs(mean-midpoint)<=.05,`${profile} rounded delay mean ${mean} vs ${midpoint}`);
 const perBot=new Map<string,number>();for(const p of plans)perBot.set(p.playerId,(perBot.get(p.playerId)??0)+Number(p.correct));assert.ok(new Set(perBot.values()).size>1,'bot totals must not be forced to a fixed quota');
 t.diagnostic(JSON.stringify({profile,answers:plans.length,correct,observedRate:rate,expectedRate:definition.correctProbability,meanDelaySeconds:mean,expectedMidpointSeconds:midpoint,minimumTicks,maximumTicks}));
});
test('B01: repeated real managers reproduce learning plans and maintenance decisions through READY',()=>{
 const first=opening('STANDARD',31001),second=opening('STANDARD',31001);assert.deepEqual(first.plans,second.plans);assert.deepEqual(first.room.players.map(p=>p.stats),second.room.players.map(p=>p.stats));
 const prepare=(r:RoomData)=>{const log:unknown[]=[],seen=new Map<string,number>();for(let i=0;!r.players.every(p=>p.state==='READY');i++){assert.ok(i<600);tickRoom(r);for(const p of r.players){if(seen.get(p.playerId)===p.bot!.decisionCounter)continue;seen.set(p.playerId,p.bot!.decisionCounter);log.push({player:p.playerId,tick:r.tick,action:p.bot!.lastAction,counter:p.bot!.decisionCounter,error:p.bot!.lastError,gold:p.gold,state:p.state,lane:p.selectedLane,selected:p.inventory.findIndex(h=>h.ownedHeroInstanceId===p.selectedOwnedHeroId),inventory:p.inventory.map(h=>({id:h.heroDefinitionId,level:h.level,power:h.powerEnhancements,vitality:h.vitalityEnhancements}))});}}return log;};
 assert.deepEqual(prepare(first.room),prepare(second.room));assert.equal(first.room.players.every(p=>p.stats.deployments===0),true);
});

const pools={NORMAL:['ALL','tank','melee','ranged','mage','support'],PREMIUM:['ALL','tank','melee','mage']} as const;
test('G05/G08/G09: every legal pool reaches every weighted hero; grade boundaries are never rerolled',()=>{
 for(const ticket of ['NORMAL','PREMIUM'] as const)for(const pool of pools[ticket]){
  const bands=ticket==='NORMAL'?[{rarity:'COMMON',low:0,high:.8},{rarity:'ADVANCED',low:.8,high:1}]:[{rarity:'COMMON',low:0,high:.3},{rarity:'ADVANCED',low:.3,high:.9},{rarity:'LEGENDARY',low:.9,high:1}];
  for(const band of bands){const eligible=HEROES.filter(h=>h.rarity===band.rarity&&(pool==='ALL'||h.role===pool));assert.ok(eligible.length);const u=(band.low+band.high)/2;assert.equal(drawDefinition(ticket,pool,band.low,0).rarity,band.rarity);assert.equal(drawDefinition(ticket,pool,band.high-Number.EPSILON,1-Number.EPSILON).rarity,band.rarity);
   for(let i=0;i<eligible.length;i++){const start=i/eligible.length,end=(i+1)/eligible.length;assert.equal(drawDefinition(ticket,pool,u,(start+end)/2).id,eligible[i].id);assert.equal(drawDefinition(ticket,pool,u,start+Number.EPSILON).id,eligible[i].id);assert.equal(drawDefinition(ticket,pool,u,end-Number.EPSILON).id,eligible[i].id);}
  }
 }
 for(const pool of ['ranged','support','unknown'])for(const u of [0,.299999,.3,.899999,.9,.999999])assert.throws(()=>drawDefinition('PREMIUM',pool,u,.5));assert.throws(()=>drawDefinition('NORMAL','unknown',.1,.5));assert.throws(()=>drawDefinition('FREE','ALL',.1,.5));
});
test('G06/G07/G09: all ten valid ticket/pool combinations preserve unconditional rarity probabilities',()=>{
 for(const ticket of ['NORMAL','PREMIUM'] as const)for(const pool of pools[ticket]){
  const rng={value:hash32(`pool-distribution/${ticket}/${pool}`)},counts={COMMON:0,ADVANCED:0,LEGENDARY:0};for(let i=0;i<100000;i++){const hero=drawDefinition(ticket,pool,nextRandom(rng),nextRandom(rng));counts[hero.rarity]++;assert.ok(pool==='ALL'||hero.role===pool);}
  const expected=ticket==='NORMAL'?{COMMON:.8,ADVANCED:.2,LEGENDARY:0}:{COMMON:.3,ADVANCED:.6,LEGENDARY:.1};for(const rarity of ['COMMON','ADVANCED','LEGENDARY'] as const)assert.ok(Math.abs(counts[rarity]/100000-expected[rarity])<=.005,`${ticket}/${pool}/${rarity}: ${counts[rarity]}`);if(ticket==='NORMAL')assert.equal(counts.LEGENDARY,0);
 }
});
test('G08: 30,000 actual legendary selections contain only the three equally weighted definitions',()=>{
 const rng={value:hash32('legendary-hero-distribution')},counts:Record<string,number>={};for(let i=0;i<30000;i++){const h=drawDefinition('PREMIUM','ALL',.9+nextRandom(rng)*.1,nextRandom(rng));assert.equal(h.rarity,'LEGENDARY');counts[h.id]=(counts[h.id]??0)+1;}assert.deepEqual(Object.keys(counts).sort(),['ancient_one','guardian_spirit','rune_mage']);for(const value of Object.values(counts))assert.ok(Math.abs(value/30000-1/3)<=.01);
});
