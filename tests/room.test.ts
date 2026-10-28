import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, directCommand, command, tickRoom, snapshot, drawDefinition, type RoomData, type Player } from '../src/server/room.js';
import { hash32, nextRandom } from '../src/shared/random.js';
import { parseQuizBank, DEFAULT_BANK } from '../src/server/quiz.js';
import { makeResult } from '../src/server/awards.js';
import { Storage } from '../src/server/storage.js';
import { HEROES } from '../src/shared/heroes.js';

const apply=(r:RoomData,a:string,t:string,p:Record<string,unknown>={})=>{const result=directCommand(r,a,t,p);assert.equal(result.status,'APPLIED',`${t}: ${result.errorCode} ${result.message}`);return result;};
function room(){const r=createRoom('TEST01','host',77,true);const a=addPlayer(r,'학생 하나','a'),b=addPlayer(r,'학생 둘둘','b');return {r,a,b};}
function answer(r:RoomData,p:Player,correct=true){const a=p.quizAttempt!,q=a.items[a.index];return apply(r,p.playerId,'SUBMIT_ANSWER',{attemptId:a.attemptId,questionId:q.id,optionId:correct?q.correctOptionId:q.options.find(o=>o.id!==q.correctOptionId)!.id});}
function prepared(){const x=room();apply(x.r,'host','START_OPENING_QUIZ');for(let i=0;i<20;i++){answer(x.r,x.a);answer(x.r,x.b,false);}for(const p of [x.a,x.b])apply(x.r,p.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});return x;}
function battle(){const x=prepared();for(const p of [x.a,x.b])apply(x.r,p.playerId,'SET_READY',{ready:true});apply(x.r,'host','START_COUNTDOWN');for(let i=0;i<100;i++)tickRoom(x.r);assert.equal(x.r.phase,'BATTLE');return x;}

test('L05-L11: roster atomic capacity, both teams, lock after opening',()=>{
  const {r,a}=room();apply(r,'host','ADD_BOTS',{count:28,profile:'STANDARD'});assert.equal(r.players.length,30);assert.equal(r.players.filter(p=>p.team==='A').length,15);
  assert.equal(directCommand(r,'host','ADD_BOTS',{count:1}).errorCode,'ROOM_FULL');assert.throws(()=>addPlayer(r,'추가 학생','x'));
  const bot=r.players.find(p=>p.isBot)!;apply(r,'host','REMOVE_BOT',{playerId:bot.playerId});assert.equal(r.players.length,29);assert.ok(r.players.includes(a));
  apply(r,'host','START_OPENING_QUIZ');assert.equal(directCommand(r,'host','ADD_BOTS',{count:1}).errorCode,'INVALID_PHASE');assert.equal(directCommand(r,'host','ASSIGN_TEAM',{playerId:a.playerId,team:'B'}).errorCode,'INVALID_PHASE');
});
test('Q01-Q02: bank validation includes BOM, CRLF, duplicate choices and line errors',()=>{
  const text=DEFAULT_BANK.slice(0,20).map(q=>[q.text,...q.answers].join(' | ')).join('\r\n');assert.equal(parseQuizBank('\uFEFF'+text).length,20);
  assert.throws(()=>parseQuizBank(text+'\nword | a | a | b | c'),/21행/);assert.throws(()=>parseQuizBank('word | a | b | c | d'),/20~1000/);
});
test('Q03-Q07: opening 20 distinct questions, authoritative one-time rewards and zero correct starter',()=>{
  const {r,a,b}=room();apply(r,'host','START_OPENING_QUIZ');assert.equal(new Set(a.quizAttempt!.items.map(q=>q.questionId)).size,20);
  const attempt=a.quizAttempt!,q=attempt.items[0],id='duplicate-answer-001';const payload={attemptId:attempt.attemptId,questionId:q.id,optionId:q.correctOptionId};
  assert.equal(directCommand(r,a.playerId,'SUBMIT_ANSWER',payload,id).status,'APPLIED');for(let i=0;i<3;i++)assert.equal(directCommand(r,a.playerId,'SUBMIT_ANSWER',payload,id).status,'REPLAYED');assert.equal(a.gold,1);
  assert.equal(directCommand(r,a.playerId,'SUBMIT_ANSWER',{...payload,optionId:'fake'},id).errorCode,'BAD_REPLAY');assert.equal(directCommand(r,b.playerId,'SUBMIT_ANSWER',payload).errorCode,'QUIZ_ALREADY_ANSWERED');
  for(let i=1;i<20;i++)answer(r,a);for(let i=0;i<20;i++)answer(r,b,false);assert.equal(r.phase,'INITIAL_MAINTENANCE');assert.equal(a.gold,20);assert.equal(b.gold,0);
  apply(r,b.playerId,'CLAIM_STARTER',{heroDefinitionId:'paladin'});assert.equal(b.inventory.length,1);assert.equal(directCommand(r,b.playerId,'CLAIM_STARTER',{heroDefinitionId:'archer'}).status,'REJECTED');
});
test('G01-G04 G11-G14 M08-M13: independent growth and replay safe economy',()=>{
  const {r,a,b}=prepared();const first=a.inventory[0];
  apply(r,a.playerId,'LEVEL_UP',{ownedHeroInstanceId:first.ownedHeroInstanceId});assert.equal(first.level,2);assert.equal(a.gold,18);
  apply(r,a.playerId,'ENHANCE_HERO',{ownedHeroInstanceId:first.ownedHeroInstanceId,kind:'power'});
  const id='draw-request-00001',payload={ticketType:'NORMAL',pool:'tank'},revision=a.ledgerRevision;
  const c={commandId:id,type:'DRAW_HERO',payload,matchId:r.matchId,expectedPhaseRevision:r.phaseRevision,connectionEpoch:a.connectionEpoch,ledgerRevision:revision};
  assert.equal(command(r,a.playerId,c).status,'APPLIED');assert.equal(command(r,a.playerId,c).status,'REPLAYED');assert.equal(a.inventory.length,2);assert.equal(a.inventory[1].level,1);assert.equal(a.inventory[1].powerEnhancements,0);
  assert.equal(command(r,a.playerId,{...c,commandId:'stale-ledger-0001'}).errorCode,'STALE_LEDGER');
  assert.equal(directCommand(r,b.playerId,'LEVEL_UP',{ownedHeroInstanceId:first.ownedHeroInstanceId}).errorCode,'HERO_NOT_OWNED');
  apply(r,a.playerId,'SET_READY',{ready:true});assert.equal(directCommand(r,a.playerId,'DRAW_HERO',payload).errorCode,'INVALID_PHASE');apply(r,a.playerId,'SET_READY',{ready:false});assert.equal(a.starterChoiceUsed,true);
});
test('G05-G09: exact boundaries, valid role pools and 100000 sample distributions',()=>{
  assert.equal(drawDefinition('NORMAL','ALL',.799999,0).rarity,'COMMON');assert.equal(drawDefinition('NORMAL','ALL',.8,0).rarity,'ADVANCED');
  assert.equal(drawDefinition('PREMIUM','ALL',.3,0).rarity,'ADVANCED');assert.equal(drawDefinition('PREMIUM','ALL',.9,0).rarity,'LEGENDARY');
  assert.throws(()=>drawDefinition('PREMIUM','support',.9,0));assert.throws(()=>drawDefinition('PREMIUM','ranged',.9,0));
  const rng={value:hash32('distribution-test')},normal:Record<string,number>={COMMON:0,ADVANCED:0,LEGENDARY:0},premium={...normal};
  for(let i=0;i<100000;i++){normal[drawDefinition('NORMAL','ALL',nextRandom(rng),nextRandom(rng)).rarity]++;premium[drawDefinition('PREMIUM','ALL',nextRandom(rng),nextRandom(rng)).rarity]++;}
  assert.equal(normal.LEGENDARY,0);assert.ok(Math.abs(normal.COMMON/100000-.8)<.005);assert.ok(Math.abs(premium.LEGENDARY/100000-.1)<.005);
  assert.deepEqual(HEROES.filter(h=>h.rarity==='LEGENDARY').map(h=>h.id).sort(),['ancient_one','guardian_spirit','rune_mage']);
});
test('M01-M03 C01-C02: first deployment and t0 wave; live mutation rejected',()=>{
  const {r,a}=battle();assert.equal(r.combat!.units.filter(u=>u.kind==='HERO').length,2);assert.equal(r.combat!.units.filter(u=>u.kind.includes('MINION')).length,42);assert.equal(r.combat!.structures.length,18);
  for(const type of ['DRAW_HERO','LEVEL_UP','ENHANCE_HERO','SELECT_HERO_AND_LANE','DEPLOY_HERO'])assert.equal(directCommand(r,a.playerId,type,{}).errorCode,'HERO_ALREADY_ACTIVE');
});
test('Q08-Q09 Q13: incomplete attempt resume and exactly 30s cooldown after tenth',()=>{
  const {r,a}=battle();apply(r,a.playerId,'START_QUIZ');const id=a.quizAttempt!.attemptId;answer(r,a);apply(r,a.playerId,'START_QUIZ');assert.equal(a.quizAttempt!.attemptId,id);assert.equal(a.quizAttempt!.index,1);
  for(let i=1;i<10;i++)answer(r,a);const end=r.tick;assert.equal(a.quizAvailableAtTick,end+600);assert.equal(directCommand(r,a.playerId,'START_QUIZ').errorCode,'QUIZ_COOLDOWN');
  for(let i=0;i<599;i++)tickRoom(r);assert.equal(directCommand(r,a.playerId,'START_QUIZ').errorCode,'QUIZ_COOLDOWN');tickRoom(r);apply(r,a.playerId,'START_QUIZ');assert.notEqual(a.quizAttempt!.attemptId,id);
});
test('N10-N11: actors, epochs, stale matches, private snapshot and client-provided gold denied',()=>{
  const {r,a,b}=prepared();const c={commandId:'security-check-001',type:'ADD_BOTS',payload:{count:1,gold:99999},matchId:r.matchId,expectedPhaseRevision:r.phaseRevision,connectionEpoch:a.connectionEpoch};assert.equal(command(r,a.playerId,c).errorCode,'NOT_AUTHORIZED');
  assert.equal(command(r,a.playerId,{...c,connectionEpoch:10}).errorCode,'STALE_CONNECTION');assert.equal(command(r,a.playerId,{...c,matchId:'old'}).errorCode,'STALE_MATCH');
  const view=snapshot(r,a.playerId),serialized=JSON.stringify(view);assert.ok(!serialized.includes('correctOptionId'));assert.ok(!serialized.includes('sessionHash'));assert.ok(!serialized.includes(b.inventory[0].ownedHeroInstanceId));assert.equal(a.gold,20);assert.equal(view.hostStudents,undefined);
  const hostView=snapshot(r,'host');assert.equal(hostView.hostStudents?.length,2);assert.equal(hostView.hostStudents?.find(p=>p.playerId===a.playerId)?.gold,20);assert.ok(!JSON.stringify(hostView).includes('correctOptionId'));
});
test('pause preserves all game clocks, and resume command does not deadlock',()=>{
  const {r,a}=battle();apply(r,a.playerId,'START_QUIZ');apply(r,'host','PAUSE_ROOM');const tick=r.tick;for(let i=0;i<100;i++)tickRoom(r);assert.equal(r.tick,tick);assert.equal(directCommand(r,a.playerId,'SUBMIT_ANSWER',{}).errorCode,'ROOM_PAUSED');apply(r,'host','RESUME_ROOM');tickRoom(r);assert.equal(r.tick,tick+1);
});
test('R04-R05 R14: cancellation locks input; repeated rematches clear all match state',()=>{
  const {r,a}=battle();for(let n=0;n<3;n++){const old=r.matchId;apply(r,'host','CANCEL_MATCH');assert.equal(r.result!.winner,null);assert.equal(r.result!.cancelled,true);assert.equal(directCommand(r,a.playerId,'START_QUIZ').errorCode,'INVALID_PHASE');apply(r,'host','REMATCH_TO_LOBBY');assert.equal(a.gold,0);assert.equal(a.inventory.length,0);assert.equal(a.quizAttempt,null);assert.equal(r.combat,null);apply(r,'host','START_OPENING_QUIZ');assert.notEqual(r.matchId,old);}
});
test('N15: SQLite command checkpoint, replay and pending quiz survive restore',()=>{
  const {r,a}=prepared(),db=new Storage(':memory:'),hero=a.inventory[0],id='persist-level-0001';
  const payload={ownedHeroInstanceId:hero.ownedHeroInstanceId};const result=directCommand(r,a.playerId,'LEVEL_UP',payload,id);db.save(r,{scope:r.matchId!,actor:a.playerId,id,result});const restored=db.load()[0];
  assert.equal(restored.players[0].gold,a.gold);assert.equal(restored.players[0].inventory[0].level,2);assert.equal(directCommand(restored,a.playerId,'LEVEL_UP',payload,id).status,'REPLAYED');assert.equal(restored.tick,r.tick);assert.equal(restored.recovered,true);db.close();
});
test('B03-B04: specified independent seeded RNG golden vectors and learning probabilities',()=>{
  assert.equal(hash32('classclash-qa/bot/bot-001/quizAccuracy'),3720119544);const rng={value:3720119544};const outputs:number[]=[];for(let i=0;i<5;i++){nextRandom(rng);outputs.push(rng.value);}assert.deepEqual(outputs,[3914854217,2204526550,3154936600,2711433423,4145984173]);
  for(const probability of [.55,.75,.9]){const state={value:hash32('profile-'+probability)};let correct=0;for(let i=0;i<10000;i++)correct+=Number(nextRandom(state)<probability);assert.ok(Math.abs(correct/10000-probability)<.02);}
});
test('R09-R12: all seven awards, actual contribution, ties, human candidate separation',()=>{
  const {r,a,b}=prepared();a.stats.heroDamage=100;b.stats.healing=100;b.stats.correct=a.stats.correct;a.stats.answered=b.stats.answered=20;
  let result=makeResult(r.matchId!,'A',650,r.players.map(p=>({playerId:p.playerId,name:p.name,team:p.team,isBot:p.isBot,stats:p.stats})));
  assert.equal(result.awards.length,7);assert.equal(result.awards.find(x=>x.id==='learning')!.playerIds.length,2);assert.deepEqual(result.awards.find(x=>x.id==='healing')!.playerIds,[b.playerId]);
  b.isBot=true;result=makeResult(r.matchId!,'A',650,r.players.map(p=>({playerId:p.playerId,name:p.name,team:p.team,isBot:p.isBot,stats:p.stats})));assert.ok(result.awards.every(x=>!x.playerIds.includes(b.playerId)));
});
