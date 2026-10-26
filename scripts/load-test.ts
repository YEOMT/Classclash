import { WebSocket } from 'ws';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DEFAULT_BANK } from '../src/server/quiz.js';
import type { RoomSnapshot, SessionInfo, CommandReply, ClientCommand } from '../src/shared/types.js';
const port=Number(process.env.TEST_PORT||3102),base=`http://127.0.0.1:${port}`;
const proc=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{env:{...process.env,PORT:String(port),DATABASE_PATH:`data/load-${Date.now()}.sqlite`,NODE_ENV:'test',CLASH_TEST_SPEED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let serverLog='';proc.stdout.on('data',x=>serverLog+=x);proc.stderr.on('data',x=>serverLog+=x);
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn:()=>boolean,ms=15000){const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw new Error('Timed out');await sleep(25);}}
async function post(path:string,data:unknown){const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result as SessionInfo;}
class Client {
  ws:WebSocket; snap?:RoomSnapshot; bytes=0; snapshots=0; pending=new Map<string,{resolve:(v:CommandReply)=>void;reject:(e:Error)=>void}>(); session:SessionInfo; welcomed=false; oldEpoch=0;
  constructor(s:SessionInfo){this.session=s;this.ws=new WebSocket(base.replace('http','ws')+'/ws');this.ws.on('open',()=>this.ws.send(JSON.stringify({type:'HELLO',roomCode:s.roomCode,token:s.token})));
    this.ws.on('message',raw=>{this.bytes+=Buffer.byteLength(raw.toString());const m=JSON.parse(raw.toString());if(m.type==='WELCOME'){this.welcomed=true;this.oldEpoch=m.connectionEpoch;}if(m.type==='SNAPSHOT'){this.snap=m.snapshot;this.snapshots++;if(m.snapshot.battle)this.ws.send(JSON.stringify({type:'EVENT_ACK',lastEventSeq:m.snapshot.battle.eventSeq}));}if(m.type==='ACK'){this.pending.get(m.reply.commandId)?.resolve(m.reply);this.pending.delete(m.reply.commandId);}if(m.type==='ERROR')console.error(m);});}
  async ready(){await waitFor(()=>!!this.snap);return this;}
  async send(type:string,payload:Record<string,unknown>={},override?:ClientCommand){const s=this.snap!;const command=override||{commandId:randomUUID(),type,payload,matchId:s.matchId,expectedPhaseRevision:s.phaseRevision,connectionEpoch:s.connectionEpoch,ledgerRevision:s.self?.ledgerRevision};
    const result=await new Promise<CommandReply>((resolve,reject)=>{this.pending.set(command.commandId,{resolve,reject});this.ws.send(JSON.stringify({type:'COMMAND',command}));setTimeout(()=>{if(this.pending.delete(command.commandId))reject(new Error('ACK timeout '+type));},10000).unref();});return {result,command};}
  async apply(type:string,payload:Record<string,unknown>={}){const {result}=await this.send(type,payload);assert.notEqual(result.status,'REJECTED',`${type}: ${result.errorCode}`);await sleep(60);return result;}
}
const clients:Client[]=[];
try{
  for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(100);}
  const host=new Client(await post('/api/rooms',{requestId:randomUUID()}));clients.push(host);await host.ready();
  const sessions=await Promise.all(Array.from({length:30},(_,i)=>post(`/api/rooms/${host.session.roomCode}/join`,{requestId:randomUUID(),name:`검증학생 ${i+1}`})));
  const students=await Promise.all(sessions.map(async s=>{const c=new Client(s);clients.push(c);return c.ready();}));
  await waitFor(()=>host.snap!.players.length===30);assert.equal(students.length,30);
  await host.apply('START_OPENING_QUIZ');await waitFor(()=>students.every(c=>c.snap?.phase==='OPENING_QUIZ'));
  for(let n=0;n<20;n++){
    await Promise.all(students.map(c=>{const a=c.snap!.self!.quiz!,q=a.question!,answer=DEFAULT_BANK.find(x=>x.text===q.text)!.answers[0],option=q.options.find(x=>x.text===answer)!;return c.apply('SUBMIT_ANSWER',{attemptId:a.attemptId,questionId:q.id,optionId:option.id});}));
    await sleep(100);
  }
  await waitFor(()=>students.every(c=>c.snap?.phase==='INITIAL_MAINTENANCE'));
  assert.ok(students.every(c=>c.snap!.self!.gold===20));
  await Promise.all(students.map(c=>c.apply('CLAIM_STARTER',{heroDefinitionId:'archer'})));await sleep(150);
  const first=students[0],draws=await Promise.all(students.map(c=>c.send('DRAW_HERO',{ticketType:'NORMAL',pool:'ALL'})));assert.ok(draws.every(d=>d.result.status==='APPLIED'));await sleep(150);
  const replays=await Promise.all(students.map((c,i)=>c.send('DRAW_HERO',{},draws[i].command)));assert.ok(replays.every(d=>d.result.status==='REPLAYED'));await sleep(150);assert.ok(students.every(c=>c.snap!.self!.inventory.length===2&&c.snap!.self!.gold===18));
  const reconnect=new Client(sessions[0]);clients.push(reconnect);await reconnect.ready();assert.equal(reconnect.snap!.self!.gold,18);assert.equal(reconnect.snap!.self!.playerId,first.snap!.self!.playerId);students[0]=reconnect;
  await Promise.all(students.map(c=>c.apply('SET_READY',{ready:true})));await waitFor(()=>host.snap!.players.every(p=>p.state==='READY'));
  await host.apply('START_COUNTDOWN');await waitFor(()=>host.snap?.phase==='BATTLE',10000);
  const wireBytes=(c:Client)=>(c.ws as unknown as {_socket:{bytesRead:number}})._socket.bytesRead;
  const started=Date.now(),bytesBefore=students.map(c=>c.bytes),wireBefore=students.map(wireBytes);await sleep(Number(process.env.LOAD_SECONDS||20)*1000);
  const elapsed=(Date.now()-started)/1000;
  assert.ok(host.snap!.battle!.units.some(u=>u.hp<u.maxHp)||host.snap!.battle!.events.some(e=>e.type==='HIT'),'Actual combat did not produce damage');
  const wireRates=students.map((c,i)=>(wireBytes(c)-wireBefore[i])/1024/elapsed);
  const result={status:'PASS',transport:'31 independent authenticated WebSocket connections, one reconnected participant; WebSocket permessage-deflate',players:30,host:1,elapsedSeconds:elapsed,snapshots:students.map(c=>c.snapshots),receivedWireKiBPerSecond:wireRates,receivedDecodedKiBPerSecond:students.map((c,i)=>(c.bytes-bytesBefore[i])/1024/elapsed),concurrentDraws:30,duplicateDrawReplays:30,duplicateDraw:'PASS',reconnect:'PASS',openingAnswers:600,battleEntities:host.snap!.battle!.units.length,serverDiagnostics:host.snap!.diagnostics,node:process.version,serverLog};
  assert.ok(Math.max(...wireRates)<=100,'Per-client mean wire bandwidth exceeds100KiB/s');
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/load-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(e){console.error(e);console.error(serverLog);process.exitCode=1;}finally{for(const c of clients)c.ws.close();proc.kill();}

