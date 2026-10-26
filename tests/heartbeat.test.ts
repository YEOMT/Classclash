import test from 'node:test';
import assert from 'node:assert/strict';
import {heartbeatDecision,HEARTBEAT_TIMEOUT_MS,type HeartbeatState} from '../src/server/heartbeat.js';

test('heartbeat: ordinary timely pongs keep a healthy connection alive and each probe is distinct',()=>{
 const state:HeartbeatState={pingSentAt:null};
 for(let now=5000;now<=300000;now+=5000){const decision=heartbeatDecision(state,now,5000);assert.equal(decision.action,'PING');assert.equal(decision.pingSentAt,now);state.pingSentAt=decision.pingSentAt;
  assert.equal(heartbeatDecision(state,now+10,10).action,'WAIT');state.pingSentAt=null; // actual pong callback
 }
});

test('heartbeat: an unanswered probe expires at15s, not before, without repeated ping resets',()=>{
 const first=heartbeatDecision({pingSentAt:null},5000,5000),state={pingSentAt:first.pingSentAt};
 for(const now of[10000,15000,19999]){const decision=heartbeatDecision(state,now,5000);assert.equal(decision.action,'WAIT');assert.equal(decision.pingSentAt,5000);}
 assert.equal(heartbeatDecision(state,5000+HEARTBEAT_TIMEOUT_MS,5000).action,'TERMINATE');
});

test('heartbeat: a stalled server gives queued healthy pongs a fresh grace instead of a false1006 termination',()=>{
 const oldState={pingSentAt:5000};const resumed=heartbeatDecision(oldState,35000,25000);assert.deepEqual(oldState,{pingSentAt:5000},'helper must not mutate caller state');assert.deepEqual(resumed,{action:'PING',pingSentAt:35000});
 const state:HeartbeatState={pingSentAt:resumed.pingSentAt};assert.equal(heartbeatDecision(state,35001,1).action,'WAIT');state.pingSentAt=null; // queued pong can now be dispatched
 assert.equal(heartbeatDecision(state,40000,5000).action,'PING');
});

test('heartbeat: a genuinely dead peer still expires15s after the server becomes responsive again',()=>{
 const state:HeartbeatState={pingSentAt:heartbeatDecision({pingSentAt:5000},35000,25000).pingSentAt};
 assert.equal(heartbeatDecision(state,40000,5000).action,'WAIT');assert.equal(heartbeatDecision(state,45000,5000).action,'WAIT');assert.equal(heartbeatDecision(state,50000,5000).action,'TERMINATE');
});

test('heartbeat: normal timer jitter cannot repeatedly extend a dead peer deadline',()=>{
 const state={pingSentAt:5000};assert.equal(heartbeatDecision(state,10500,5500).action,'WAIT');assert.equal(heartbeatDecision(state,16000,5500).action,'WAIT');assert.equal(heartbeatDecision(state,21500,5500).action,'TERMINATE');
 assert.equal(heartbeatDecision({pingSentAt:5000},21500,6001).action,'PING','a known server scheduling gap gets one fresh probe');
});

test('heartbeat: an initially stalled loop probes both new and previously waiting clients before judging them',()=>{
 for(const pending of[null,0,5000]){const result=heartbeatDecision({pingSentAt:pending},60000,60000);assert.equal(result.action,'PING');assert.equal(result.pingSentAt,60000);}
});
