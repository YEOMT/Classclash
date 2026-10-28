import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {DEFAULT_BANK} from '../src/server/quiz.js';
import type {RoomSnapshot,SessionInfo,CommandReply} from '../src/shared/types.js';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn:()=>boolean){for(let i=0;i<300;i++){if(fn())return;await sleep(20);}throw new Error('Timed out');}
test('actual broadcasts keep two student wallets, quiz attempts and connection epochs private',{timeout:30000},async t=>{
  const port=3194,base=`http://127.0.0.1:${port}`,proc=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{windowsHide:true,env:{...process.env,NODE_ENV:'test',CLASH_TEST_SPEED:'1',HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:'',HOST_ACCESS_CODE:'',HOST_ACCESS_CODE_FILE:'',DATABASE_PATH:join(tmpdir(),'wire-private-'+randomUUID()+'.sqlite')},stdio:['ignore','pipe','pipe']});
  let log='';proc.stdout!.on('data',x=>log+=x);proc.stderr!.on('data',x=>log+=x);const clients:WebSocket[]=[];t.after(()=>{for(const ws of clients)ws.terminate();proc.kill();});
  let ready=false;for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await sleep(30);}assert.ok(ready,log);
  const post=async(path:string,payload:unknown)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,201);return await r.json() as SessionInfo;};
  async function connect(session:SessionInfo){const ws=new WebSocket(base.replace('http','ws')+'/ws');clients.push(ws);const client={ws,snap:undefined as RoomSnapshot|undefined,replies:new Map<string,CommandReply>()};ws.on('open',()=>ws.send(JSON.stringify({type:'HELLO',...session})));ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='SNAPSHOT')client.snap=m.snapshot;if(m.type==='ACK')client.replies.set(m.reply.commandId,m.reply);});await waitFor(()=>!!client.snap);return client;}
  const hostSession=await post('/api/rooms',{requestId:randomUUID()}),aSession=await post(`/api/rooms/${hostSession.roomCode}/join`,{requestId:randomUUID(),name:'Student A'}),bSession=await post(`/api/rooms/${hostSession.roomCode}/join`,{requestId:randomUUID(),name:'Student B'});
  const host=await connect(hostSession),a=await connect(aSession),b=await connect(bSession);
  async function command(client:typeof host,type:string,payload={}){const commandId=randomUUID(),s=client.snap!;client.ws.send(JSON.stringify({type:'COMMAND',command:{commandId,type,payload,matchId:s.matchId,expectedPhaseRevision:s.phaseRevision,connectionEpoch:s.connectionEpoch}}));await waitFor(()=>client.replies.has(commandId));assert.equal(client.replies.get(commandId)!.status,'APPLIED');}
  await command(host,'START_OPENING_QUIZ');await waitFor(()=>a.snap?.phase==='OPENING_QUIZ'&&b.snap?.phase==='OPENING_QUIZ');
  const quiz=a.snap!.self!.quiz!,q=quiz.question!,answer=DEFAULT_BANK.find(x=>x.text===q.text)!.answers[0],option=q.options.find(x=>x.text===answer)!;
  await command(a,'SUBMIT_ANSWER',{attemptId:quiz.attemptId,questionId:q.id,optionId:option.id});await waitFor(()=>a.snap!.self!.gold===1);await sleep(150);
  assert.equal(b.snap!.self!.gold,0);assert.notEqual(a.snap!.self!.playerId,b.snap!.self!.playerId);assert.notEqual(a.snap!.self!.quiz!.attemptId,b.snap!.self!.quiz!.attemptId);assert.equal(a.snap!.self!.quiz!.index,1);assert.equal(b.snap!.self!.quiz!.index,0);
  const reconnected=await connect(aSession);await sleep(150);assert.equal(reconnected.snap!.self!.gold,1);assert.equal(reconnected.snap!.connectionEpoch,2);assert.equal(b.snap!.connectionEpoch,1);assert.equal(b.snap!.self!.gold,0);
});
