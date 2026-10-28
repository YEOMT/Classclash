import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { resolve, extname, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import { addPlayer, command, createRoom, snapshot, tickRoom, type Actor, type RoomData } from './room.js';
import { RuleError, requireRule } from './errors.js';
import { Storage, type DurableCommand, type LedgerCheckpoint } from './storage.js';
import type { ClientCommand, CommandReply, RoomSnapshot, SessionInfo } from '../shared/types.js';
import {CURRENT_VERSIONS} from './versions.js';
import {heartbeatDecision,HEARTBEAT_INTERVAL_MS} from './heartbeat.js';
import {serverConfig,allowedOrigin,validHostCode,RequestLimiter} from './production-config.js';
import {runtimeBuildInfo} from './build-info.js';
import {displayUnitNumbers,snapshotEncoder} from './wire-projection.js';

const config=serverConfig(),dev=process.argv.includes('--dev'),port=config.port,host=config.host;
// Test runner acceleration changes wall-clock scheduling only. Production never enables it.
const testSpeed=config.testSpeed;
const storage=new Storage(config.databasePath);
const rooms=new Map(storage.load().map(r=>[r.roomCode,r]));
const httpLimiter=new RequestLimiter();
let shuttingDown=false;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const tokenFor=(id:string,roomId:string)=>createHmac('sha256',storage.secret).update(`${id}/${roomId}`).digest('hex');
const json=(res:http.ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req:http.IncomingMessage):Promise<Record<string,unknown>>{let text='';for await(const chunk of req){text+=chunk;requireRule(Buffer.byteLength(text)<500000,'INVALID_INPUT');}try{return JSON.parse(text||'{}');}catch{throw new RuleError('INVALID_INPUT');}}
function session(room:RoomData,actor:string,requestId:string):SessionInfo{return {roomId:room.roomId,roomCode:room.roomCode,token:tokenFor(requestId,room.roomId),playerId:actor==='host'?null:actor,role:actor==='host'?'host':'student'};}
let vite:Awaited<ReturnType<typeof import('vite')['createServer']>>|undefined;
if(dev){const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true},appType:'spa'});}
const webroot=resolve('dist/client');
const buildInfo=runtimeBuildInfo(dev?resolve('public'):webroot);
// The shipped assets are small. Preload before accepting clients so a synchronized
// folder's disk latency cannot consume libuv workers while WebSocket zlib needs them.
const staticFiles=new Map<string,Buffer>();
async function preloadStatic(directory:string,cacheDirectory=directory):Promise<void>{
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name),cachePath=resolve(cacheDirectory,entry.name);
    if(entry.isDirectory())await preloadStatic(path,cachePath);
    else if(entry.isFile())staticFiles.set(cachePath,await readFile(path));
  }
}
if(dev)await preloadStatic(resolve('public'),webroot);
else if(existsSync(webroot))await preloadStatic(webroot);
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/','http://localhost');
    if(url.pathname==='/api/health'){json(res,shuttingDown?503:200,{ok:!shuttingDown,rooms:rooms.size,activeRooms:[...rooms.values()].filter(r=>!['RESULT','CANCELLED'].includes(r.phase)).length,draining:existsSync(config.drainFile),storage:'sqlite-wal',version:buildInfo.appVersion,...buildInfo,tickHz:20,versions:CURRENT_VERSIONS});return;}
    if(url.pathname==='/api/config'){json(res,200,{hostAccessRequired:!!config.hostAccessCode,publicOrigin:config.publicOrigin,...buildInfo});return;}
    if(req.method==='POST'&&(url.pathname==='/api/rooms'||/^\/api\/rooms\/[^/]+\/join$/.test(url.pathname))){
      requireRule(!shuttingDown,'SERVER_DRAINING','서버 업데이트 중입니다. 잠시 후 다시 연결하세요.');
      requireRule(allowedOrigin(req,config),'NOT_AUTHORIZED');
      const creating=url.pathname==='/api/rooms',peer=req.socket.remoteAddress||'unknown';
      requireRule(httpLimiter.allow(`${creating?'create':'join'}/${peer}`,creating?10:180,60000),'RATE_LIMIT');
      const data=await body(req),requestId=String(data.requestId||'');requireRule(requestId.length>=16&&requestId.length<=160,'INVALID_INPUT');
      if(creating)requireRule(validHostCode(data.accessCode,config.hostAccessCode),'NOT_AUTHORIZED','방 생성 접근 코드를 확인하세요.');
      const fingerprint=sha(JSON.stringify({path:url.pathname,name:data.name})),previous=storage.request(requestId);
      if(previous){requireRule(previous.fingerprint===fingerprint,'BAD_REPLAY');const r=rooms.get(previous.room_code);requireRule(r,'ROOM_NOT_FOUND');json(res,200,session(r,previous.actor_id,requestId));return;}
      if(url.pathname==='/api/rooms'){
        requireRule(!existsSync(config.drainFile),'SERVER_DRAINING','업데이트 준비 중에는 새 방을 만들 수 없습니다. 기존 수업은 계속됩니다.');
        requireRule([...rooms.values()].filter(r=>!['RESULT','CANCELLED'].includes(r.phase)).length<config.maxActiveRooms,'SERVER_FULL','현재 운영 가능한 수업 방 수에 도달했습니다.');
        let code='';do{code=randomBytes(5).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
        const r=createRoom(code,'');r.hostSessionHash=sha(tokenFor(requestId,r.roomId));storage.save(r,undefined,{id:requestId,fingerprint,actor:'host'});rooms.set(code,r);json(res,201,session(r,'host',requestId));return;
      }
      const code=decodeURIComponent(url.pathname.split('/')[3]).toUpperCase(),r=rooms.get(code);requireRule(r,'ROOM_NOT_FOUND');const before=structuredClone(r);
      try{const p=addPlayer(r,String(data.name||''),sha(tokenFor(requestId,r.roomId)));storage.save(r,undefined,{id:requestId,fingerprint,actor:p.playerId});json(res,201,session(r,p.playerId,requestId));broadcast(r);return;}catch(e){rooms.set(code,before);throw e;}
    }
    if(url.pathname.startsWith('/api/')){json(res,404,{errorCode:'NOT_FOUND',message:'API 경로를 확인하세요.'});return;}
    let path=resolve(webroot,'.'+decodeURIComponent(url.pathname));requireRule(path===webroot||path.startsWith(webroot+sep),'NOT_AUTHORIZED');
    if(vite&&!staticFiles.has(path)){vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});return;}
    if(!extname(path))path=resolve(webroot,'index.html');
    const file=staticFiles.get(path);if(!file){res.writeHead(404);res.end('Not found. Run npm run build before npm start.');return;}
    const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':file.length,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Cache-Control':'no-cache'});res.end(file);
  }catch(e){const error=e instanceof RuleError?e:new RuleError('STORAGE_UNAVAILABLE');if(!(e instanceof RuleError))console.error('HTTP failure:',(e as Error).message);json(res,error.code==='RATE_LIMIT'?429:error.code==='NOT_AUTHORIZED'?403:['SERVER_FULL','SERVER_DRAINING'].includes(error.code)?503:400,{errorCode:error.code,message:error.message});}
});
interface Client { socket:WebSocket; roomCode:string; actor:Actor; epoch:number; alive:boolean; lastPongAt:number;pingSentAt:number|null;lastEventSeq:number; rateAt:number; rate:number; lastSnapshot:number; lastMatchId?:string|null }
const clients=new Set<Client>();
const diagnostics=process.env.CLASH_DIAGNOSTICS==='1';
function reportSlow(label:string,started:number,detail=''){const ms=performance.now()-started;if(diagnostics&&ms>50)console.error(JSON.stringify({diagnostic:label,ms:Math.round(ms),detail,at:new Date().toISOString()}));}
const wss=new WebSocketServer({server,path:'/ws',maxPayload:500000,verifyClient:(info:{req:http.IncomingMessage})=>!shuttingDown&&allowedOrigin(info.req,config),perMessageDeflate:{threshold:1024,concurrencyLimit:4,zlibDeflateOptions:{level:1}}});
function send(ws:WebSocket,data:unknown){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
let seq=0;
const lastBroadcast=new Map<string,number>();
let diagnosticAt=0, tickPercentiles={tickP50:0,tickP95:0,tickP99:0};
// Project public combat once per broadcast. Every recipient still gets its own private projection and event ACK cursor.
function publicBattle(r:RoomData):RoomSnapshot['battle']{
  const battle=snapshot(r,'public-view',0).battle;if(!battle)return null;
  const project=(u:Record<string,unknown>)=>{
    const fields=['entityId','deploymentId','kind','team','lane','position','jungle','monsterKind','campId','debugReason','ownerPlayerId','ownedHeroInstanceId','heroDefinitionId','level','role','hp','maxHp','radius','range','x','y','previousX','previousY','projectileSpeed','vx','vy','facingX','facingY','state','createdTick','deathTick','shield','statuses','marks','protected','actionId','actionStartTick','impactTick','recoveryEndTick','targetId'];
    const result:Record<string,unknown>={};for(const key of fields)if(u[key]!==undefined)result[key]=u[key];
    const action=u.action as Record<string,unknown>|null;result.action=action?Object.fromEntries(['skillId','startTick','impactTicks','recoveryEndTick','origin','point','direction'].map(k=>[k,action[k]])):null;return displayUnitNumbers(result);
  };
  battle.units=battle.units.map(u=>project(u as unknown as Record<string,unknown>)) as unknown as typeof battle.units;
  battle.structures=battle.structures.map(u=>project(u as unknown as Record<string,unknown>)) as unknown as typeof battle.structures;
  delete battle.decisions;
  return battle;
}
function wireSnapshot(r:RoomData,c:Client,battle:RoomSnapshot['battle']=publicBattle(r)){
  if(c.lastMatchId!==r.matchId){c.lastMatchId=r.matchId;c.lastEventSeq=0;}
  const snap=snapshot(r,c.actor,++seq,false);
  snap.battle=battle?{...battle,events:battle.events.filter(e=>e.eventSeq>c.lastEventSeq&&e.tick>=r.tick-200)}:null;
  if(c.actor==='host'){
    if(performance.now()-diagnosticAt>1000){const sorted=[...metrics].sort((a,b)=>a-b),pct=(p:number)=>sorted[Math.floor((sorted.length-1)*p)]||0;tickPercentiles={tickP50:pct(.5),tickP95:pct(.95),tickP99:pct(.99)};diagnosticAt=performance.now();}
    snap.diagnostics={...tickPercentiles,backlogMs:accumulator,clients:[...clients].filter(x=>x.roomCode===r.roomCode).length,bots:r.players.filter(p=>p.bot).map(p=>({playerId:p.playerId,lastAction:p.bot!.lastAction,lastError:p.bot!.lastError})),stalls:r.botDiagnostics};
  }
  if(testSpeed!==1)snap.testSpeed=testSpeed;
  return snap;
}
function broadcast(r:RoomData){const started=performance.now();lastBroadcast.set(r.roomCode,started);const battle=[...clients].some(c=>c.roomCode===r.roomCode)?publicBattle(r):null,encode=snapshotEncoder(battle,r.tick);for(const c of clients){if(c.roomCode!==r.roomCode)continue;// Skip obsolete snapshots while the previous one drains. Keep the connection and
  // bounded event replay so command acknowledgements do not wait behind megabytes of old state.
  if(c.socket.bufferedAmount>256*1024)continue;const snap=wireSnapshot(r,c,null);if(c.socket.readyState===WebSocket.OPEN)c.socket.send(encode(snap,c.lastEventSeq));}reportSlow('broadcast',started,`${r.phase}/${r.tick}`);}
const queue:{client:Client;command:ClientCommand}[]=[];
wss.on('connection',(ws,req)=>{
  // Protocol errors (oversized/invalid frames) belong to this peer, not the authority process.
  ws.on('error',()=>ws.terminate());
  const messageLimiter=new RequestLimiter();
  let client:Client|null=null;const authTimeout=setTimeout(()=>{if(!client)ws.close(1008,'Authentication required');},5000);
  ws.on('pong',()=>{if(client){client.alive=true;client.lastPongAt=performance.now();client.pingSentAt=null;}});
  ws.on('message',raw=>{let receivedCommandId:string|undefined;try{
    requireRule(messageLimiter.allow('all',60,1000),'RATE_LIMIT');
    const m=JSON.parse(raw.toString());
    requireRule(m&&typeof m==='object'&&!Array.isArray(m),'INVALID_INPUT');
    if(typeof m.command?.commandId==='string')receivedCommandId=m.command.commandId;
    if(m.type==='HELLO'){
      requireRule(!m.protocolVersion||m.protocolVersion===buildInfo.protocolVersion,'VERSION_MISMATCH','새 버전으로 새로고침한 뒤 같은 세션으로 연결하세요.');
      requireRule(!client,'INVALID_INPUT');const r=rooms.get(String(m.roomCode).toUpperCase());requireRule(r,'ROOM_NOT_FOUND');const hash=sha(String(m.token));
      const p=r.players.find(p=>!p.isBot&&p.sessionHash===hash),actor:Actor=r.hostSessionHash===hash?'host':p?.playerId||'';requireRule(actor,'NOT_AUTHORIZED');
      const epoch=actor==='host'?++r.hostConnectionEpoch:++p!.connectionEpoch;if(p)p.online=true;
      for(const old of clients)if(old.roomCode===r.roomCode&&old.actor===actor){send(old.socket,{type:'REPLACED',message:'다른 창에서 연결되었습니다.'});old.socket.close(4001,'Replaced by another tab');}
      client={socket:ws,roomCode:r.roomCode,actor,epoch,alive:true,lastPongAt:performance.now(),pingSentAt:null,lastEventSeq:Number(m.lastEventSeq)||0,rateAt:performance.now(),rate:0,lastSnapshot:0};clients.add(client);clearTimeout(authTimeout);
      storage.save(r);send(ws,{type:'WELCOME',connectionEpoch:epoch,version:buildInfo});send(ws,{type:'SNAPSHOT',snapshot:wireSnapshot(r,client)});return;
    }
    requireRule(client,'NOT_AUTHORIZED');
    if(m.type==='EVENT_ACK'){const r=rooms.get(client.roomCode);const value=Number(m.lastEventSeq);if(Number.isInteger(value)&&value>=client.lastEventSeq&&value<=(r?.combat?.eventSeq||0))client.lastEventSeq=value;return;}
    if(m.type==='RESYNC'){requireRule(messageLimiter.allow('resync',3,1000),'RATE_LIMIT');const r=rooms.get(client.roomCode);if(r)send(ws,{type:'SNAPSHOT',snapshot:wireSnapshot(r,client)});return;}
    requireRule(m.type==='COMMAND'&&m.command&&typeof m.command.type==='string','INVALID_INPUT');
    const now=performance.now();if(now-client.rateAt>1000){client.rateAt=now;client.rate=0;}requireRule(++client.rate<=10,'RATE_LIMIT');
    requireRule(queue.length<1000,'RATE_LIMIT');queue.push({client,command:m.command});
  }catch(e){const err=e instanceof RuleError?e:new RuleError('INVALID_INPUT');if(receivedCommandId)send(ws,{type:'ACK',reply:{commandId:receivedCommandId,status:'REJECTED',errorCode:err.code,message:err.message,serverTick:client?rooms.get(client.roomCode)?.tick||0:0,phaseRevision:client?rooms.get(client.roomCode)?.phaseRevision||0:0}});else send(ws,{type:'ERROR',errorCode:err.code,message:err.message});}});
  ws.on('close',()=>{clearTimeout(authTimeout);if(client){clients.delete(client);const r=rooms.get(client.roomCode),p=r?.players.find(p=>p.playerId===client!.actor);if(p&&p.connectionEpoch===client.epoch)p.online=false;}});
});
let last=performance.now(),accumulator=0;
const metrics:number[]=[];
let pendingCommandCpuMs=0;
const timer=setInterval(()=>{
  const now=performance.now();if(diagnostics&&now-last>250)console.error(JSON.stringify({diagnostic:'event-loop-gap',ms:Math.round(now-last),at:new Date().toISOString()}));accumulator+=(now-last)*testSpeed;last=now;
  const commandPumpStarted=performance.now();
  // The command pump remains active during pause, and applies in receive order before damage.
  const changed=new Set<string>();
  const batches=new Map<string,{before:RoomData;commands:DurableCommand[];ledger:LedgerCheckpoint[];replies:{client:Client;reply:CommandReply;durableReplay:boolean}[];failed:Error|null}>();
  while(queue.length){const item=queue.shift()!,r=rooms.get(item.client.roomCode);if(!r)continue;
    let batch=batches.get(r.roomCode);if(!batch){batch={before:structuredClone(r),commands:[],ledger:[],replies:[],failed:null};batches.set(r.roomCode,batch);}
    const scope=r.matchId||r.roomId+'/'+r.lobbyEpoch;
    try{
      if(batch.failed)throw batch.failed;
      const result=command(r,item.client.actor,item.command),durableReplay=result.status==='REPLAYED'&&!!batch.before.replies[scope+'/'+item.client.actor+'/'+item.command.commandId];
      batch.replies.push({client:item.client,reply:result,durableReplay});
      if(result.status==='APPLIED'){
        batch.commands.push({scope,actor:item.client.actor,id:item.command.commandId,result});
        if(r.matchId)for(const p of r.players)batch.ledger.push({scope:r.matchId,actor:p.playerId,revision:p.ledgerRevision,gold:p.gold,earned:p.stats.earned,spent:p.stats.spent});
      }
    }catch(e){batch.failed=e as Error;batch.replies.push({client:item.client,reply:{commandId:item.command.commandId,status:'REJECTED',serverTick:r.tick,phaseRevision:r.phaseRevision},durableReplay:false});}
  }
  for(const [code,batch] of batches){const r=rooms.get(code)!;
    try{if(batch.failed)throw batch.failed;if(batch.commands.length)storage.saveCommandBatch(r,batch.commands,batch.ledger);}
    catch(e){batch.failed=e as Error;rooms.set(code,batch.before);console.error('Command batch commit failed:',(e as Error).message);}
    for(const item of batch.replies){const reply=batch.failed&&!item.durableReplay?{commandId:item.reply.commandId,status:'REJECTED',errorCode:'STORAGE_UNAVAILABLE',message:'저장하지 못했습니다. 같은 요청으로 다시 연결하세요.',serverTick:batch.before.tick,phaseRevision:batch.before.phaseRevision}:item.reply;send(item.client.socket,{type:'ACK',reply});}
    changed.add(code);
  }
  for(const code of changed){const r=rooms.get(code);if(r)broadcast(r);}
  pendingCommandCpuMs+=performance.now()-commandPumpStarted;
  let catchup=0;
  while(accumulator>=50&&catchup++<5){const begin=performance.now();for(const r of rooms.values()){
      const previousPhase=r.phase,previousTick=r.tick,stepAt=performance.now();tickRoom(r);reportSlow('tickRoom',stepAt,`${r.phase}/${r.tick}`);
      if((r.tick!==previousTick&&r.tick%20===0&&!['LOBBY','RESULT','CANCELLED'].includes(r.phase))||previousPhase!==r.phase){const saveAt=performance.now();try{storage.save(r);}catch(e){r.paused=true;console.error('Checkpoint failed; room paused:',(e as Error).message);}reportSlow('checkpoint',saveAt,`${r.phase}/${r.tick}`);}
      if(performance.now()-(lastBroadcast.get(r.roomCode)||0)>=100||previousPhase!==r.phase)broadcast(r);
    }metrics.push(performance.now()-begin+pendingCommandCpuMs);pendingCommandCpuMs=0;if(metrics.length>30000)metrics.shift();accumulator-=50;}
},10);
let lastHeartbeatCheck=performance.now();
const heartbeat=setInterval(()=>{
  const now=performance.now(),elapsed=now-lastHeartbeatCheck;lastHeartbeatCheck=now;
  for(const c of clients){
    if(c.socket.readyState!==WebSocket.OPEN)continue;
    const decision=heartbeatDecision(c,now,elapsed);c.pingSentAt=decision.pingSentAt;
    if(decision.action==='TERMINATE'){console.warn('Heartbeat timeout:',{room:c.roomCode,actor:c.actor,lastPongAgeMs:now-c.lastPongAt,pingAgeMs:now-c.pingSentAt!,loopGapMs:elapsed,bufferedAmount:c.socket.bufferedAmount});c.socket.terminate();}
    else if(decision.action==='PING'){c.alive=false;c.socket.ping();}
  }
},HEARTBEAT_INTERVAL_MS);
const cleanup=setInterval(()=>{
  const expired=[...rooms.values()].filter(r=>['LOBBY','RESULT','CANCELLED'].includes(r.phase)&&Date.now()-Date.parse(r.updatedAt)>config.roomExpiryHours*3600000&&![...clients].some(c=>c.roomCode===r.roomCode)).map(r=>r.roomCode);
  if(expired.length){const removed=storage.expireInactive(expired,config.roomExpiryHours);for(const code of removed){rooms.delete(code);lastBroadcast.delete(code);}}
},60000);
server.listen(port,host,()=>console.log(`Class Clash ${dev?'development':'production'}: http://${host}:${port} (Node ${process.version}, SQLite WAL)`));
function shutdown(){if(shuttingDown)return;shuttingDown=true;clearInterval(timer);clearInterval(heartbeat);clearInterval(cleanup);let exitCode=0;try{for(const r of rooms.values())storage.save(r);storage.checkpoint();}catch(e){exitCode=1;console.error('Final checkpoint failed:',(e as Error).message);}for(const c of clients)c.socket.close(1001,'Server restarting; reconnect with the same session');wss.close();server.close(()=>{void vite?.close();storage.close();process.exit(exitCode);});setTimeout(()=>{for(const c of clients)c.socket.terminate();storage.close();process.exit(exitCode);},5000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
