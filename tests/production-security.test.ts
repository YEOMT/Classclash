import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {serverConfig,validHostCode,RequestLimiter,allowedOrigin} from '../src/server/production-config.js';
import {Storage} from '../src/server/storage.js';
import {createRoom,addPlayer} from '../src/server/room.js';
import type {IncomingMessage} from 'node:http';

test('production configuration fails closed, uses only configured origin, and disables test speed',()=>{
  assert.throws(()=>serverConfig({NODE_ENV:'production'}),/Production requires/);
  assert.throws(()=>serverConfig({NODE_ENV:'production',APP_ORIGIN:'http://class.invalid'}),/HTTPS/);
  const c=serverConfig({NODE_ENV:'production',APP_ORIGIN:'https://class.invalid',HOST_ACCESS_CODE:'sixteen-character-test-code',DATABASE_PATH:'data/test.sqlite',CLASH_TEST_SPEED:'20'});
  assert.equal(c.testSpeed,1);assert.equal(c.host,'0.0.0.0');assert.equal(c.maxActiveRooms,1);
  const req=(headers:Record<string,string>)=>({headers} as IncomingMessage);
  assert.equal(allowedOrigin(req({origin:'https://class.invalid',host:'spoof.invalid','x-forwarded-host':'evil.invalid'}),c),true);
  assert.equal(allowedOrigin(req({origin:'https://evil.invalid',host:'evil.invalid','x-forwarded-proto':'https'}),c),false);
  assert.equal(allowedOrigin(req({host:'class.invalid'}),c),false);
  assert.equal(validHostCode('bad',c.hostAccessCode),false);assert.equal(validHostCode(c.hostAccessCode,c.hostAccessCode),true);
});

test('NAT-safe request budgets isolate routes and sessions',()=>{
  const limiter=new RequestLimiter();
  for(let i=0;i<30;i++)assert.equal(limiter.allow('join/shared-school',180,60000,1),true);
  for(let i=0;i<10;i++)assert.equal(limiter.allow('create/shared-school',10,60000,1),true);
  assert.equal(limiter.allow('create/shared-school',10,60000,1),false);
  assert.equal(limiter.allow('join/shared-school',180,60000,1),true);
  assert.equal(limiter.allow('create/shared-school',10,60000,60001),true);
});

test('online SQLite backup preserves WAL transactions, session secret, request and ledger state',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'clash-backup-')),db=new Storage(join(dir,'active.sqlite'));
  try{
    const room=createRoom('BACKUP','host-hash'),p=addPlayer(room,'복구 학생','student-hash');
    room.matchId='backup-match';p.gold=3;p.stats.earned=3;p.ledgerRevision=3;
    db.save(room,{scope:room.matchId,actor:p.playerId,id:'durable-answer',result:{status:'APPLIED'}},{id:'join-request',fingerprint:'fingerprint',actor:p.playerId});
    const backup=await db.backupTo(join(dir,'snapshot.sqlite'));
    const restored=new Storage(backup);try{
      assert.equal(restored.secret,db.secret);const actual=restored.load()[0];assert.equal(actual.players[0].gold,3);
      assert.equal(restored.request('join-request')?.actor_id,p.playerId);
      assert.equal((restored.db.prepare('SELECT gold FROM economy_ledger').get() as {gold:number}).gold,3);
      assert.equal((restored.db.prepare('SELECT result FROM command_results').get() as {result:string}).result,'{"status":"APPLIED"}');
    }finally{restored.close();}
    await assert.rejects(db.backupTo(backup),/already exists/);
  }finally{db.close();}
});

test('actual production HTTP/WS gates host creation, wrong origins, classroom joins and drain mode',{timeout:40000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'clash-production-')),port=3197,base=`http://127.0.0.1:${port}`,origin='https://class.invalid',accessCode='local-test-code-not-a-secret',drain=join(dir,'drain');
  let log='';const proc:ChildProcess=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),NODE_ENV:'production',APP_ORIGIN:origin,HOST_ACCESS_CODE:accessCode,HOST_ACCESS_CODE_FILE:'',DATABASE_PATH:join(dir,'test.sqlite'),DRAIN_FILE:drain,MAX_ACTIVE_ROOMS:'1'},stdio:['ignore','pipe','pipe']});
  proc.stdout!.on('data',x=>log+=x);proc.stderr!.on('data',x=>log+=x);
  const sockets:WebSocket[]=[];t.after(()=>{for(const ws of sockets)ws.terminate();proc.kill();});
  let ready=false;for(let i=0;i<200;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,log);
  const post=(path:string,payload:unknown,requestOrigin=origin)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin},body:JSON.stringify(payload)});
  assert.equal((await post('/api/rooms',{requestId:randomUUID(),accessCode},'https://evil.invalid')).status,403);
  assert.equal((await post('/api/rooms',{requestId:randomUUID(),accessCode:'wrong'})).status,403);
  const conf=await (await fetch(base+'/api/config')).json();assert.equal(conf.publicOrigin,origin);assert.equal(conf.hostAccessRequired,true);assert.ok(!JSON.stringify(conf).includes(accessCode));
  const hostId=randomUUID(),hostResponse=await post('/api/rooms',{requestId:hostId,accessCode});assert.equal(hostResponse.status,201);const host=await hostResponse.json();
  assert.deepEqual(await (await post('/api/rooms',{requestId:hostId,accessCode})).json(),host);
  assert.equal((await post('/api/rooms',{requestId:randomUUID(),accessCode})).status,503);
  const joins=await Promise.all(Array.from({length:30},(_,i)=>post(`/api/rooms/${host.roomCode}/join`,{requestId:randomUUID(),name:`NAT 학생 ${i+1}`})));assert.ok(joins.every(r=>r.status===201));
  const ws=new WebSocket(base.replace('http','ws')+'/ws',{origin});sockets.push(ws);
  const welcome=await new Promise<Record<string,unknown>>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No welcome')),6000);ws.on('open',()=>ws.send(JSON.stringify({type:'HELLO',roomCode:host.roomCode,token:host.token})));ws.on('message',raw=>{const msg=JSON.parse(raw.toString());if(msg.type==='WELCOME'){clearTimeout(timer);resolve(msg);}});ws.on('error',reject);});assert.ok(welcome.version);
  const rejected=new WebSocket(base.replace('http','ws')+'/ws',{origin:'https://evil.invalid'});sockets.push(rejected);
  const rejectedStatus=await new Promise<number>((resolve,reject)=>{rejected.on('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode!);});rejected.on('open',()=>reject(new Error('Unauthorized origin opened')));rejected.on('error',()=>{});});assert.equal(rejectedStatus,401);
  writeFileSync(drain,'maintenance');const health=await (await fetch(base+'/api/health')).json();assert.equal(health.draining,true);assert.equal(health.activeRooms,1);
  assert.equal((await post('/api/rooms',{requestId:randomUUID(),accessCode})).status,503);
});
