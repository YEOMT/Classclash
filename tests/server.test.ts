import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { ClientCommand, CommandReply, RoomSnapshot, SessionInfo } from '../src/shared/types.js';
import { DEFAULT_BANK } from '../src/server/quiz.js';
import { HEROES } from '../src/shared/heroes.js';

const delay=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(f:()=>boolean,limit=10000){const start=Date.now();while(!f()){assert.ok(Date.now()-start<limit,'Timed out waiting for server state');await delay(20);}}
test('actual HTTP/WS process: durable answer ACK survives forced restart, duplicate request, epoch and auth isolation', {timeout:45000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'classclash-recovery-')),port=3193,base=`http://127.0.0.1:${port}`,db=join(dir,'test.sqlite');let proc:ChildProcess|undefined;const sockets:WebSocket[]=[];let log='';
  const start=async()=>{proc=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATABASE_PATH:db},stdio:['ignore','pipe','pipe']});proc.stdout!.on('data',x=>log+=x);proc.stderr!.on('data',x=>log+=x);for(let i=0;i<150;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await delay(50);}throw new Error(log);};
  const stop=async()=>{if(!proc)return;const child=proc;await new Promise<void>(resolve=>{child.once('exit',()=>resolve());child.kill('SIGKILL');if(child.exitCode!==null)resolve();});proc=undefined;};
  t.after(async()=>{for(const s of sockets)s.terminate();await stop();});
  const post=async(path:string,data:unknown)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(res.status<300,true);return await res.json() as SessionInfo;};
  const connect=async(session:SessionInfo)=>{
    const ws=new WebSocket(base.replace('http','ws')+'/ws');sockets.push(ws);let snap:RoomSnapshot|undefined;const replies=new Map<string,CommandReply>();let replaced=false;
    ws.on('open',()=>ws.send(JSON.stringify({type:'HELLO',roomCode:session.roomCode,token:session.token})));
    ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='SNAPSHOT')snap=m.snapshot;if(m.type==='ACK')replies.set(m.reply.commandId,m.reply);if(m.type==='REPLACED')replaced=true;});
    await until(()=>!!snap);
    return {ws,get snap(){return snap!;},get replaced(){return replaced;},async send(type:string,payload:Record<string,unknown>={},original?:ClientCommand){const c:ClientCommand=original?{...original,connectionEpoch:snap!.connectionEpoch}:{commandId:randomUUID(),type,payload,matchId:snap!.matchId,expectedPhaseRevision:snap!.phaseRevision,connectionEpoch:snap!.connectionEpoch,ledgerRevision:snap!.self?.ledgerRevision};replies.delete(c.commandId);ws.send(JSON.stringify({type:'COMMAND',command:c}));await until(()=>replies.has(c.commandId));await delay(70);return {reply:replies.get(c.commandId)!,command:c};}};
  };
  await start();const createId=randomUUID(),hostSession=await post('/api/rooms',{requestId:createId});assert.deepEqual(await post('/api/rooms',{requestId:createId}),hostSession);
  const joinId=randomUUID(),studentSession=await post(`/api/rooms/${hostSession.roomCode}/join`,{requestId:joinId,name:'복구 학생'});assert.deepEqual(await post(`/api/rooms/${hostSession.roomCode}/join`,{requestId:joinId,name:'복구 학생'}),studentSession);
  const host=await connect(hostSession),student=await connect(studentSession);
  // Regression: first battle assets must not starve command ACKs or health responses.
  const assetsStarted=Date.now();
  const [pngs,health,assetConcurrentCommand]=await Promise.all([
    Promise.all(HEROES.map(async hero=>{const response=await fetch(`${base}/assets/heroes/${hero.id}.png`);assert.equal(response.status,200,hero.id);const bytes=Buffer.from(await response.arrayBuffer());assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10],hero.id);assert.ok(bytes.length>32,hero.id);return{hero:hero.id,bytes:bytes.length};})),
    fetch(base+'/api/health').then(async response=>{assert.equal(response.status,200);return response.json();}),
    host.send('ADD_BOTS',{count:1})
  ]);
  assert.equal(pngs.length,18);assert.equal(health.ok,true);assert.equal(assetConcurrentCommand.reply.status,'APPLIED');assert.ok(Date.now()-assetsStarted<10000,'18 PNG downloads, health and authenticated ACK must all complete within 10s');t.diagnostic(`18 concurrent hero PNGs: ${pngs.reduce((n,p)=>n+p.bytes,0)} bytes, health + ADD_BOTS ACK in ${Date.now()-assetsStarted}ms`);
  assert.equal((await host.send('START_OPENING_QUIZ')).reply.status,'APPLIED');await until(()=>student.snap.phase==='OPENING_QUIZ');
  const quiz=student.snap.self!.quiz!,q=quiz.question!,correct=DEFAULT_BANK.find(x=>x.text===q.text)!.answers[0],option=q.options.find(o=>o.text===correct)!;
  const original=await student.send('SUBMIT_ANSWER',{attemptId:quiz.attemptId,questionId:q.id,optionId:option.id});assert.equal(original.reply.status,'APPLIED');assert.equal(student.snap.self!.gold,1);
  const before={id:student.snap.self!.playerId,attempt:student.snap.self!.quiz!.attemptId,index:student.snap.self!.quiz!.index,gold:student.snap.self!.gold};
  await stop();await start();const restored=await connect(studentSession),restoredHost=await connect(hostSession);
  assert.deepEqual({id:restored.snap.self!.playerId,attempt:restored.snap.self!.quiz!.attemptId,index:restored.snap.self!.quiz!.index,gold:restored.snap.self!.gold},before);assert.equal(restored.snap.recovered,true);
  assert.equal((await restored.send('SUBMIT_ANSWER',{},original.command)).reply.status,'REPLAYED');assert.equal(restored.snap.self!.gold,1);
  assert.equal((await restored.send('ADD_BOTS',{count:1})).reply.errorCode,'NOT_AUTHORIZED');assert.equal((await restored.send('GIVE_GOLD',{amount:10000})).reply.status,'REJECTED');assert.equal(restored.snap.self!.gold,1);
  const newest=await connect(studentSession);await until(()=>restored.replaced);assert.ok(newest.snap.connectionEpoch>restored.snap.connectionEpoch);
  assert.ok(!JSON.stringify(newest.snap).includes('correctOptionId'));assert.ok(!JSON.stringify(newest.snap).includes('sessionHash'));
  assert.equal((await restoredHost.send('PAUSE_ROOM')).reply.status,'APPLIED');const pausedTick=restoredHost.snap.tick;await delay(250);assert.equal(restoredHost.snap.tick,pausedTick);
  assert.equal((await restoredHost.send('RESUME_ROOM')).reply.status,'APPLIED');assert.equal((await restoredHost.send('CANCEL_MATCH')).reply.status,'APPLIED');assert.equal(restoredHost.snap.result!.cancelled,true);
  // L05: independent lobby, one remaining seat, actual HTTP join races authenticated WS ADD_BOTS.
  const raceSession=await post('/api/rooms',{requestId:randomUUID()}),raceHost=await connect(raceSession);
  assert.equal((await raceHost.send('ADD_BOTS',{count:29,profile:'STANDARD'})).reply.status,'APPLIED');await until(()=>raceHost.snap.players.length===29);
  const racingJoinId=randomUUID();
  const [joinResponse,botResponse]=await Promise.all([
    fetch(`${base}/api/rooms/${raceSession.roomCode}/join`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:racingJoinId,name:'마지막 학생'})}),
    raceHost.send('ADD_BOTS',{count:1,profile:'STANDARD'})
  ]);
  const joinBody=await joinResponse.json() as SessionInfo|{errorCode?:string};
  assert.equal(Number(joinResponse.ok)+Number(botResponse.reply.status==='APPLIED'),1,'exactly one of the human and AI may claim the last seat');
  if(joinResponse.ok){assert.equal(botResponse.reply.errorCode,'ROOM_FULL');assert.deepEqual(await post(`/api/rooms/${raceSession.roomCode}/join`,{requestId:racingJoinId,name:'마지막 학생'}),joinBody);}
  else{assert.ok(JSON.stringify(joinBody).includes('ROOM_FULL'));assert.equal(botResponse.reply.status,'APPLIED');}
  await until(()=>raceHost.snap.players.length===30);assert.equal(new Set(raceHost.snap.players.map(p=>p.playerId)).size,30);assert.equal(raceHost.snap.players.filter(p=>p.team==='A').length,15);assert.equal(raceHost.snap.players.filter(p=>p.team==='B').length,15);assert.equal(raceHost.snap.players.filter(p=>!p.isBot).length,Number(joinResponse.ok));
});
