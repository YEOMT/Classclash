import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Storage,type DurableCommand,type LedgerCheckpoint} from '../src/server/storage.js';
import {createRoom,addPlayer} from '../src/server/room.js';

test('ordered command batch persists every economy revision and survives reopening',()=>{
  const dir=mkdtempSync(join(tmpdir(),'clash-batch-')),path=join(dir,'test.sqlite'),db=new Storage(path);
  const room=createRoom('BAT001','host'),p=addPlayer(room,'학생','session');room.matchId='match-batch';db.save(room);
  const records:DurableCommand[]=[],ledger:LedgerCheckpoint[]=[];
  for(let i=1;i<=3;i++){p.gold=i;p.stats.earned=i;p.ledgerRevision=i;records.push({scope:room.matchId,actor:p.playerId,id:`answer-${i}`,result:{status:'APPLIED',gold:i}});ledger.push({scope:room.matchId,actor:p.playerId,revision:i,gold:i,earned:i,spent:0});}
  db.saveCommandBatch(room,records,ledger);db.close();
  const restored=new Storage(path);try{
    assert.equal(restored.load()[0].players[0].gold,3);
    assert.deepEqual(restored.db.prepare('SELECT revision,gold FROM economy_ledger ORDER BY revision').all().map(r=>[r.revision,r.gold]),[[0,0],[1,1],[2,2],[3,3]]);
    assert.equal(restored.db.prepare('SELECT count(*) AS n FROM command_results').get()!.n,3);
  }finally{restored.close();}
});

test('late batch storage failure rolls back room, new command results and ledger while preserving prior durable results',()=>{
  const db=new Storage(':memory:');try{
    const room=createRoom('BAT002','host'),p=addPlayer(room,'학생','session');room.matchId='match-failure';
    db.save(room,{scope:room.matchId,actor:p.playerId,id:'prior-durable',result:{status:'APPLIED',gold:0}});
    db.db.exec("CREATE TRIGGER fail_batch BEFORE INSERT ON command_results WHEN NEW.command_id='fail' BEGIN SELECT RAISE(ABORT,'injected storage failure'); END");
    p.gold=2;p.stats.earned=2;p.ledgerRevision=2;
    const records=[{scope:room.matchId,actor:p.playerId,id:'new',result:{status:'APPLIED',draw:'uncommitted-result'}},{scope:room.matchId,actor:p.playerId,id:'fail',result:{status:'APPLIED'}}];
    assert.throws(()=>db.saveCommandBatch(room,records,[{scope:room.matchId!,actor:p.playerId,revision:2,gold:2,earned:2,spent:0}]),/injected/);
    assert.equal(db.load()[0].players[0].gold,0);
    assert.deepEqual(db.db.prepare('SELECT command_id FROM command_results').all().map(r=>r.command_id),['prior-durable']);
    assert.deepEqual(db.db.prepare('SELECT revision,gold FROM economy_ledger').all().map(r=>[r.revision,r.gold]),[[0,0]]);
    db.db.exec('DROP TRIGGER fail_batch');db.saveCommandBatch(room,records,[{scope:room.matchId,actor:p.playerId,revision:2,gold:2,earned:2,spent:0}]);
    assert.equal(db.load()[0].players[0].gold,2);assert.equal(db.db.prepare('SELECT count(*) AS n FROM command_results').get()!.n,3);
  }finally{db.close();}
});
