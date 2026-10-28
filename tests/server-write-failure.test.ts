import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {WebSocket} from 'ws';
import type {RoomSnapshot,ClientCommand,CommandReply} from '../src/shared/types.js';
import {DEFAULT_BANK} from '../src/server/quiz.js';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(f:()=>boolean){for(let i=0;i<400;i++){if(f())return;await sleep(25);}throw new Error('Timed out');}

test('actual storage failure rejects new reward ACK without leaking result; prior durable replay and retry survive restart',{timeout:45000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'clash-write-failure-')),dbPath=join(dir,'test.sqlite'),port=3198,base=`http://127.0.0.1:${port}`;
  let proc:ChildProcess,log='';const sockets:WebSocket[]=[];
  async function start(){proc=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'test',CLASH_TEST_SPEED:'1',APP_ORIGIN:'',HOST_ACCESS_CODE:'',HOST_ACCESS_CODE_FILE:'',DATABASE_PATH:dbPath},stdio:['ignore','pipe','pipe']});proc.stdout!.on('data',x=>log+=x);proc.stderr!.on('data',x=>log+=x);for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await sleep(50);}throw new Error(log);}
  async function stop(){if(proc.exitCode!==null)return;await new Promise<void>(resolve=>{proc.once('exit',()=>resolve());proc.kill('SIGKILL');});}
  t.after(async()=>{for(const ws of sockets)ws.terminate();await stop();});
  const post=async(path:string,payload:unknown)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.ok(r.ok);return r.json();};
  async function connect(session:{roomCode:string;token:string}){
    const ws=new WebSocket(base.replace('http','ws')+'/ws');sockets.push(ws);let snap:RoomSnapshot|undefined;const replies=new Map<string,CommandReply>();
    ws.on('open',()=>ws.send(JSON.stringify({type:'HELLO',...session})));ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.type==='SNAPSHOT')snap=m.snapshot;if(m.type==='ACK')replies.set(m.reply.commandId,m.reply);});await until(()=>!!snap);
    return {get snap(){return snap!;},command(type:string,payload:Record<string,unknown>={},id:string=randomUUID()):ClientCommand{return{type,payload,commandId:id,matchId:snap!.matchId,expectedPhaseRevision:snap!.phaseRevision,connectionEpoch:snap!.connectionEpoch,ledgerRevision:snap!.self?.ledgerRevision};},async send(command:ClientCommand){replies.delete(command.commandId);ws.send(JSON.stringify({type:'COMMAND',command:{...command,connectionEpoch:snap!.connectionEpoch}}));await until(()=>replies.has(command.commandId));return replies.get(command.commandId)!;}};
  }
  await start();const h=await post('/api/rooms',{requestId:randomUUID()}),p=await post(`/api/rooms/${h.roomCode}/join`,{requestId:randomUUID(),name:'저장 오류 학생'});
  const host=await connect(h),student=await connect(p);assert.equal((await host.send(host.command('ADD_BOTS',{count:1}))).status,'APPLIED');assert.equal((await host.send(host.command('START_OPENING_QUIZ'))).status,'APPLIED');await until(()=>student.snap.phase==='OPENING_QUIZ');
  const answerCommand=(id?:string)=>{const a=student.snap.self!.quiz!,q=a.question!,answer=DEFAULT_BANK.find(x=>x.text===q.text)!.answers[0],option=q.options.find(x=>x.text===answer)!;return student.command('SUBMIT_ANSWER',{attemptId:a.attemptId,questionId:q.id,optionId:option.id},id);};
  const first=answerCommand();assert.equal((await student.send(first)).status,'APPLIED');await until(()=>student.snap.self!.gold===1);
  const fault=new DatabaseSync(dbPath);fault.exec("CREATE TRIGGER fail_reward BEFORE INSERT ON command_results WHEN NEW.command_id='injected-write-failure' BEGIN SELECT RAISE(ABORT,'injected write failure'); END");
  const second=answerCommand('injected-write-failure');const [replayed,rejected]=await Promise.all([student.send(first),student.send(second)]);
  assert.equal(replayed.status,'REPLAYED');assert.equal(rejected.status,'REJECTED');assert.equal(rejected.errorCode,'STORAGE_UNAVAILABLE');assert.equal(rejected.publicResult,undefined);await sleep(150);assert.equal(student.snap.self!.gold,1);assert.equal(student.snap.self!.quiz!.index,1);
  const saved=JSON.parse((fault.prepare('SELECT state FROM rooms WHERE room_code=?').get(h.roomCode) as {state:string}).state);assert.equal(saved.players.find((x:{isBot:boolean})=>!x.isBot).gold,1);
  fault.exec('DROP TRIGGER fail_reward');fault.close();assert.equal((await student.send(second)).status,'APPLIED');await until(()=>student.snap.self!.gold===2);
  await stop();await start();const restored=await connect(p);assert.equal(restored.snap.self!.gold,2);assert.equal(restored.snap.self!.quiz!.index,2);assert.equal((await restored.send(second)).status,'REPLAYED');assert.equal(restored.snap.self!.gold,2);
});
