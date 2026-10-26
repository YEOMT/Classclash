import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptSnapshot} from '../src/client/snapshot-order.js';
test('restart accepts reset sequence only for the authenticated new epoch',()=>{
 const old={connectionEpoch:4,matchId:'same-match',snapshotSeq:800};
 assert.equal(acceptSnapshot(old,{...old,connectionEpoch:5,snapshotSeq:0},5),true);
 assert.equal(acceptSnapshot(old,{...old,snapshotSeq:799},4),false);
 assert.equal(acceptSnapshot(old,{...old,snapshotSeq:801},5),false);
 assert.equal(acceptSnapshot(old,{...old,connectionEpoch:6,snapshotSeq:0},5),false);
 assert.equal(acceptSnapshot(old,{...old,matchId:'new-match',snapshotSeq:801},4),true);
 assert.equal(acceptSnapshot(old,{...old,matchId:'previous-match',snapshotSeq:799},4),false);
 assert.equal(acceptSnapshot(old,{...old,matchId:'previous-match',snapshotSeq:800},4),false);
});
