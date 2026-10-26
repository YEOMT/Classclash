import test from 'node:test';
import assert from 'node:assert/strict';
import {Storage} from '../src/server/storage.js';
import {createRoom,addPlayer,directCommand,type RoomData} from '../src/server/room.js';
import {CURRENT_VERSIONS,RULES_VERSION,fingerprint,type RuntimeVersions} from '../src/server/versions.js';
import {HEROES} from '../src/shared/heroes.js';
import {BALANCE} from '../src/shared/balance.js';
import {BOT_TACTICS} from '../src/shared/bot-balance.js';

function active(code='VERS01'){
 const r=createRoom(code,'host');addPlayer(r,'복원 학생 A','a');addPlayer(r,'복원 학생 B','b');assert.equal(directCommand(r,'host','START_OPENING_QUIZ').status,'APPLIED');return r;
}
function stored(db:Storage,code:string){return (db.db.prepare('SELECT state FROM rooms WHERE room_code=?').get(code) as {state:string}|undefined)?.state;}
const stale=(r:RoomData)=>{r.updatedAt=new Date(Date.now()-25*60*60*1000).toISOString();return r;};
const storeRequest=(db:Storage,r:RoomData)=>db.save(r,undefined,{id:`request-${r.roomCode}`,fingerprint:'fingerprint',actor:'host'});

test('runtime fingerprints cover exact hero content, balance and bot tactics with stable object ordering',()=>{
 assert.equal(CURRENT_VERSIONS.rulesVersion,RULES_VERSION);assert.equal(CURRENT_VERSIONS.contentHash,fingerprint(HEROES));assert.equal(CURRENT_VERSIONS.balanceHash,fingerprint({balance:BALANCE,botTactics:BOT_TACTICS}));assert.match(CURRENT_VERSIONS.contentHash,/^[a-f0-9]{64}$/);assert.match(CURRENT_VERSIONS.balanceHash,/^[a-f0-9]{64}$/);
 assert.equal(fingerprint({a:1,b:{y:2,x:3}}),fingerprint({b:{x:3,y:2},a:1}));assert.notEqual(fingerprint([1,2]),fingerprint([2,1]));
 const changed=structuredClone(HEROES);changed[0].baseStats.hp++;assert.notEqual(CURRENT_VERSIONS.contentHash,fingerprint(changed));assert.notEqual(CURRENT_VERSIONS.balanceHash,fingerprint({balance:BALANCE,botTactics:{...BOT_TACTICS,objectiveWeight:BOT_TACTICS.objectiveWeight+1}}));
});
for(const phase of ['OPENING_QUIZ','INITIAL_MAINTENANCE','COUNTDOWN','BATTLE'] as const)for(const key of ['rulesVersion','contentHash','balanceHash'] as (keyof RuntimeVersions)[])test(`${phase}: incompatible ${key} refuses recovery without writing the checkpoint`,()=>{
 const db=new Storage(':memory:');try{const r=active();r.phase=phase;r.versions={...CURRENT_VERSIONS,[key]:'previous-version'};storeRequest(db,r);const before=stored(db,r.roomCode);assert.throws(()=>db.load(),new RegExp(`Incompatible active checkpoint.*${r.roomCode}.*${key}.*Database preserved`));assert.equal(stored(db,r.roomCode),before);assert.ok(db.request(`request-${r.roomCode}`));}finally{db.close();}
});
test('legacy active checkpoint without version metadata fails explicitly; valid checkpoint restores absolute game time',()=>{
 const db=new Storage(':memory:');try{const r=active();r.tick=1234;r.players[0].quizAvailableAtTick=1400;db.save(r);const json=JSON.parse(stored(db,r.roomCode)!);delete json.versions;db.db.prepare('UPDATE rooms SET state=? WHERE room_code=?').run(JSON.stringify(json),r.roomCode);assert.throws(()=>db.load(),/rulesVersion, contentHash, balanceHash/);db.save(r);const recovered=db.load()[0];assert.equal(recovered.tick,1234);assert.equal(recovered.players[0].quizAvailableAtTick,1400);assert.equal(recovered.players[0].quizAttempt!.attemptId,r.players[0].quizAttempt!.attemptId);assert.deepEqual(recovered.versions,CURRENT_VERSIONS);assert.equal(recovered.recovered,true);}finally{db.close();}
});
test('incompatible finalized result or lobby remains inspectable without changing settled result data',()=>{
 const db=new Storage(':memory:');try{const lobby=createRoom('LOBBY1','host'),finished=active('FINAL1');assert.equal(directCommand(finished,'host','CANCEL_MATCH').status,'APPLIED');const result=structuredClone(finished.result);for(const r of[lobby,finished]){r.versions={...CURRENT_VERSIONS,rulesVersion:'legacy-rules'};db.save(r);}const rooms=db.load();assert.ok(rooms.every(r=>r.versions.rulesVersion===RULES_VERSION));assert.deepEqual(rooms.find(r=>r.roomCode==='FINAL1')!.result,result);assert.equal(JSON.parse(stored(db,'FINAL1')!).versions.rulesVersion,'legacy-rules','read-only recovery must not silently overwrite stored metadata');}finally{db.close();}
});
test('unsupported checkpoint schema fails before attempting a running engine restore',()=>{
 const db=new Storage(':memory:');try{const r=active();db.save(r);const json=JSON.parse(stored(db,r.roomCode)!);json.version=99;db.db.prepare('UPDATE rooms SET state=? WHERE room_code=?').run(JSON.stringify(json),r.roomCode);assert.throws(()=>db.load(),/Unsupported checkpoint version/);assert.equal(JSON.parse(stored(db,r.roomCode)!).version,99);}finally{db.close();}
});
test('safe legacy lobby restores newly added bot diagnostics defaults without overwriting existing values or saved rows',()=>{
 const db=new Storage(':memory:');try{const r=createRoom('OLDBOT','host');assert.equal(directCommand(r,'host','ADD_BOTS',{count:2}).status,'APPLIED');r.tick=421;r.players[1].bot!.lastAction='PRESERVED';r.players[1].bot!.lastProgressTick=123;db.save(r);const json=JSON.parse(stored(db,r.roomCode)!);delete json.versions;delete json.botDiagnostics;delete json.players[0].bot.maintenanceStartedTick;delete json.players[0].bot.lastProgressTick;delete json.players[0].bot.lastAction;const before=JSON.stringify(json);db.db.prepare('UPDATE rooms SET state=? WHERE room_code=?').run(before,r.roomCode);const restored=db.load()[0];assert.deepEqual(restored.botDiagnostics,[]);assert.equal(restored.players[0].bot!.maintenanceStartedTick,421);assert.equal(restored.players[0].bot!.lastProgressTick,421);assert.equal(restored.players[0].bot!.lastAction,'WAITING');assert.equal(restored.players[1].bot!.lastAction,'PRESERVED');assert.equal(restored.players[1].bot!.lastProgressTick,123);assert.equal(stored(db,r.roomCode),before);}finally{db.close();}
});
test('inactive expiry removes only requested old lobby/results and their join/create requests, preserving match records',()=>{
 const db=new Storage(':memory:');try{
  const old=stale(createRoom('OLD001','host')),fresh=createRoom('NEW001','host'),running=stale(active('RUN001')),finished=active('END001'),unlisted=stale(createRoom('KEEP01','host'));assert.equal(directCommand(finished,'host','CANCEL_MATCH').status,'APPLIED');stale(finished);
  for(const r of[old,fresh,running,finished,unlisted])storeRequest(db,r);const resultsBefore=db.db.prepare('SELECT COUNT(*) AS n FROM match_results').get()!.n,ledgerBefore=db.db.prepare('SELECT COUNT(*) AS n FROM economy_ledger').get()!.n;
  assert.deepEqual(db.expireInactive(['OLD001','OLD001','END001','NEW001','RUN001','MISSING']),['OLD001','END001']);assert.equal(stored(db,'OLD001'),undefined);assert.equal(stored(db,'END001'),undefined);assert.equal(db.request('request-OLD001'),undefined);assert.equal(db.request('request-END001'),undefined);for(const code of['NEW001','RUN001','KEEP01']){assert.ok(stored(db,code));assert.ok(db.request(`request-${code}`));}assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM match_results').get()!.n,resultsBefore);assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM economy_ledger').get()!.n,ledgerBefore);
 }finally{db.close();}
});
test('expiry is atomic when a database deletion fails; original rooms and request tokens stay recoverable',()=>{
 const db=new Storage(':memory:');try{for(const code of['ROLL01','ROLL02'])storeRequest(db,stale(createRoom(code,'host')));db.db.exec("CREATE TRIGGER fail_expiry BEFORE DELETE ON rooms WHEN OLD.room_code='ROLL02' BEGIN SELECT RAISE(ABORT,'injected expiry failure'); END;");assert.throws(()=>db.expireInactive(['ROLL01','ROLL02']),/injected expiry failure/);for(const code of['ROLL01','ROLL02']){assert.ok(stored(db,code));assert.ok(db.request(`request-${code}`));}}finally{db.close();}
});
test('expiry preserves malformed or mismatched identity records for diagnosis instead of deleting them',()=>{
 const db=new Storage(':memory:');try{const r=stale(createRoom('IDENT1','host'));storeRequest(db,r);const json=JSON.parse(stored(db,r.roomCode)!);json.roomId='another-room-id';db.db.prepare('UPDATE rooms SET state=? WHERE room_code=?').run(JSON.stringify(json),r.roomCode);assert.deepEqual(db.expireInactive([r.roomCode]),[]);assert.ok(stored(db,r.roomCode));assert.ok(db.request(`request-${r.roomCode}`));}finally{db.close();}
});
