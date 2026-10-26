import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { resolve, extname, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { WebSocket, WebSocketServer } from 'ws';
import { addPlayer, command, createRoom, snapshot, tickRoom, type Actor, type RoomData } from './room.js';
import { RuleError, requireRule } from './errors.js';
import { Storage } from './storage.js';
import type { ClientCommand, SessionInfo } from '../shared/types.js';

const dev=process.argv.includes('--dev'),port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
// Test runner acceleration changes wall-clock scheduling only. Production never enables it.
const testSpeed=process.env.NODE_ENV==='test'?Math.max(1,Math.min(20,Number(process.env.CLASH_TEST_SPEED||1))):1;
const storage=new Storage(process.env.DATABASE_PATH||'data/class-clash.sqlite');
const rooms=new Map(storage.load().map(r=>[r.roomCode,r]));
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const tokenFor=(id:string,roomId:string)=>createHmac('sha256',storage.secret).update(`${id}/${roomId}`).digest('hex');
const json=(res:http.ServerResponse,status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req:http.IncomingMessage):Promise<Record<string,unknown>>{let text='';for await(const chunk of req){text+=chunk;requireRule(Buffer.byteLength(text)<500000,'INVALID_INPUT');}try{return JSON.parse(text||'{}');}catch{throw new RuleError('INVALID_INPUT');}}
function session(room:RoomData,actor:string,requestId:string):SessionInfo{return {roomId:room.roomId,roomCode:room.roomCode,token:tokenFor(requestId,room.roomId),playerId:actor==='host'?null:actor,role:actor==='host'?'host':'student'};}
let vite:Awaited<ReturnType<typeof import('vite')['createServer']>>|undefined;
if(dev){const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true},appType:'spa'});}
const webroot=resolve('dist/client');
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host}`);
    if(url.pathname==='/api/health'){json(res,200,{ok:true,rooms:rooms.size,storage:'sqlite-wal',version:'0.1.0',tickHz:20});return;}
    if(req.method==='POST'&&(url.pathname==='/api/rooms'||/^\/api\/rooms\/[^/]+\/join$/.test(url.pathname))){
      const origin=req.headers.origin;if(origin)requireRule(origin===`http://${req.headers.host}`||origin===`https://${req.headers.host}`||origin===process.env.APP_ORIGIN,'NOT_AUTHORIZED');
      const data=await body(req),requestId=String(data.requestId||'');requireRule(requestId.length>=16&&requestId.length<=160,'INVALID_INPUT');
      const fingerprint=sha(JSON.stringify({path:url.pathname,name:data.name})),previous=storage.request(requestId);
      if(previous){requireRule(previous.fingerprint===fingerprint,'BAD_REPLAY');const r=rooms.get(previous.room_code);requireRule(r,'ROOM_NOT_FOUND');json(res,200,session(r,previous.actor_id,requestId));return;}
      if(url.pathname==='/api/rooms'){
        let code='';do{code=randomBytes(5).toString('hex').slice(0,6).toUpperCase();}while(rooms.has(code));
        const r=createRoom(code,'');r.hostSessionHash=sha(tokenFor(requestId,r.roomId));storage.save(r,undefined,{id:requestId,fingerprint,actor:'host'});rooms.set(code,r);json(res,201,session(r,'host',requestId));return;
      }
      const code=decodeURIComponent(url.pathname.split('/')[3]).toUpperCase(),r=rooms.get(code);requireRule(r,'ROOM_NOT_FOUND');const before=structuredClone(r);
      try{const p=addPlayer(r,String(data.name||''),sha(tokenFor(requestId,r.roomId)));storage.save(r,undefined,{id:requestId,fingerprint,actor:p.playerId});json(res,201,session(r,p.playerId,requestId));broadcast(r);return;}catch(e){rooms.set(code,before);throw e;}
    }
    if(url.pathname.startsWith('/api/')){json(res,404,{errorCode:'NOT_FOUND',message:'API 경로를 확인하세요.'});return;}
    if(vite){vite.middlewares(req,res,()=>{res.writeHead(404);res.end();});return;}
    let path=resolve(webroot,'.'+decodeURIComponent(url.pathname));requireRule(path===webroot||path.startsWith(webroot+sep),'NOT_AUTHORIZED');
    if(!extname(path))path=resolve(webroot,'index.html');
    if(!existsSync(path)){res.writeHead(404);res.end('Not found');return;}
    if(!(await stat(path)).isFile()){res.writeHead(404);res.end();return;}
    const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json','.svg':'image/svg+xml','.wav':'audio/wav'};
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});createReadStream(path).pipe(res);
  }catch(e){const error=e instanceof RuleError?e:new RuleError('STORAGE_UNAVAILABLE');if(!(e instanceof RuleError))console.error('HTTP failure:',(e as Error).message);json(res,400,{errorCode:error.code,message:error.message});}
});
interface Client { socket:WebSocket; roomCode:string; actor:Actor; epoch:number; alive:boolean; lastPongAt:number;lastEventSeq:number; rateAt:number; rate:number; lastSnapshot:number; lastMatchId?:string|null }
const clients=new Set<Client>();
const wss=new WebSocketServer({server,path:'/ws',maxPayload:500000,perMessageDeflate:{threshold:1024}});
function send(ws:WebSocket,data:unknown){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
let seq=0;
const lastBroadcast=new Map<string,number>();
let diagnosticAt=0, tickPercentiles={tickP50:0,tickP95:0,tickP99:0};
function wireSnapshot(r:RoomData,c:Client){
  if(c.lastMatchId!==r.matchId){c.lastMatchId=r.matchId;c.lastEventSeq=0;}
  const snap=snapshot(r,c.actor,++seq);
  if(c.actor==='host'){
    if(performance.now()-diagnosticAt>1000){const sorted=[...metrics].sort((a,b)=>a-b),pct=(p:number)=>sorted[Math.floor((sorted.length-1)*p)]||0;tickPercentiles={tickP50:pct(.5),tickP95:pct(.95),tickP99:pct(.99)};diagnosticAt=performance.now();}
    snap.diagnostics={...tickPercentiles,backlogMs:accumulator,clients:[...clients].filter(x=>x.roomCode===r.roomCode).length,bots:r.players.filter(p=>p.bot).map(p=>({playerId:p.playerId,lastAction:p.bot!.lastAction,lastError:p.bot!.lastError})),stalls:r.botDiagnostics};
  }
  if(testSpeed!==1)snap.testSpeed=testSpeed;
  if(snap.battle){
    // Durable state stays complete; only render-facing fields cross the wire.
    const project=(u:Record<string,unknown>)=>{
      const fields=['entityId','deploymentId','kind','team','lane','ownerPlayerId','ownedHeroInstanceId','heroDefinitionId','level','role','hp','maxHp','radius','range','x','y','previousX','previousY','projectileSpeed','vx','vy','facingX','facingY','state','createdTick','deathTick','shield','statuses','marks','protected','actionId','actionStartTick','impactTick','recoveryEndTick','targetId'];
      const result:Record<string,unknown>={};for(const key of fields)if(u[key]!==undefined)result[key]=u[key];
      const action=u.action as Record<string,unknown>|null;result.action=action?Object.fromEntries(['skillId','startTick','impactTicks','recoveryEndTick','origin','point','direction'].map(k=>[k,action[k]])):null;return result;
    };
    snap.battle.units=snap.battle.units.map(u=>project(u as unknown as Record<string,unknown>)) as unknown as typeof snap.battle.units;
    snap.battle.structures=snap.battle.structures.map(u=>project(u as unknown as Record<string,unknown>)) as unknown as typeof snap.battle.structures;
    snap.battle.events=snap.battle.events.filter(e=>e.eventSeq>c.lastEventSeq&&e.tick>=r.tick-200);
  }
  return snap;
}
function broadcast(r:RoomData){lastBroadcast.set(r.roomCode,performance.now());for(const c of clients){if(c.roomCode!==r.roomCode)continue;if(c.socket.bufferedAmount>2_000_000){c.socket.close(1013,'Connection too slow; reconnect for full state');continue;}send(c.socket,{type:'SNAPSHOT',snapshot:wireSnapshot(r,c)});}}
const queue:{client:Client;command:ClientCommand}[]=[];
wss.on('connection',(ws,req)=>{
  const origin=req.headers.origin;
  if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`&&origin!==process.env.APP_ORIGIN){ws.close(1008,'Origin rejected');return;}
  let client:Client|null=null;const authTimeout=setTimeout(()=>{if(!client)ws.close(1008,'Authentication required');},5000);
  ws.on('pong',()=>{if(client){client.alive=true;client.lastPongAt=performance.now();}});
  ws.on('message',raw=>{let receivedCommandId:string|undefined;try{
    const m=JSON.parse(raw.toString());
    if(typeof m.command?.commandId==='string')receivedCommandId=m.command.commandId;
    if(m.type==='HELLO'){
      requireRule(!client,'INVALID_INPUT');const r=rooms.get(String(m.roomCode).toUpperCase());requireRule(r,'ROOM_NOT_FOUND');const hash=sha(String(m.token));
      const p=r.players.find(p=>!p.isBot&&p.sessionHash===hash),actor:Actor=r.hostSessionHash===hash?'host':p?.playerId||'';requireRule(actor,'NOT_AUTHORIZED');
      const epoch=actor==='host'?++r.hostConnectionEpoch:++p!.connectionEpoch;if(p)p.online=true;
      for(const old of clients)if(old.roomCode===r.roomCode&&old.actor===actor){send(old.socket,{type:'REPLACED',message:'다른 창에서 연결되었습니다.'});old.socket.close(4001,'Replaced by another tab');}
      client={socket:ws,roomCode:r.roomCode,actor,epoch,alive:true,lastPongAt:performance.now(),lastEventSeq:Number(m.lastEventSeq)||0,rateAt:performance.now(),rate:0,lastSnapshot:0};clients.add(client);clearTimeout(authTimeout);
      storage.save(r);send(ws,{type:'WELCOME',connectionEpoch:epoch});send(ws,{type:'SNAPSHOT',snapshot:wireSnapshot(r,client)});return;
    }
    requireRule(client,'NOT_AUTHORIZED');
    if(m.type==='EVENT_ACK'){const r=rooms.get(client.roomCode);const value=Number(m.lastEventSeq);if(Number.isInteger(value)&&value>=client.lastEventSeq&&value<=(r?.combat?.eventSeq||0))client.lastEventSeq=value;return;}
    if(m.type==='RESYNC'){const r=rooms.get(client.roomCode);if(r)send(ws,{type:'SNAPSHOT',snapshot:wireSnapshot(r,client)});return;}
    requireRule(m.type==='COMMAND'&&m.command&&typeof m.command.type==='string','INVALID_INPUT');
    const now=performance.now();if(now-client.rateAt>1000){client.rateAt=now;client.rate=0;}requireRule(++client.rate<=10,'RATE_LIMIT');
    requireRule(queue.length<1000,'RATE_LIMIT');queue.push({client,command:m.command});
  }catch(e){const err=e instanceof RuleError?e:new RuleError('INVALID_INPUT');if(receivedCommandId)send(ws,{type:'ACK',reply:{commandId:receivedCommandId,status:'REJECTED',errorCode:err.code,message:err.message,serverTick:client?rooms.get(client.roomCode)?.tick||0:0,phaseRevision:client?rooms.get(client.roomCode)?.phaseRevision||0:0}});else send(ws,{type:'ERROR',errorCode:err.code,message:err.message});}});
  ws.on('close',()=>{clearTimeout(authTimeout);if(client){clients.delete(client);const r=rooms.get(client.roomCode),p=r?.players.find(p=>p.playerId===client!.actor);if(p&&p.connectionEpoch===client.epoch)p.online=false;}});
});
let last=performance.now(),accumulator=0;
const metrics:number[]=[];
const timer=setInterval(()=>{
  const now=performance.now();accumulator+=(now-last)*testSpeed;last=now;
  // The command pump remains active during pause, and applies in receive order before damage.
  const changed=new Set<string>();
  while(queue.length){const item=queue.shift()!,r=rooms.get(item.client.roomCode);if(!r)continue;const before=structuredClone(r),scope=r.matchId||`${r.roomId}/${r.lobbyEpoch}`;
    try{const result=command(r,item.client.actor,item.command);if(result.status==='APPLIED')storage.save(r,{scope,actor:item.client.actor,id:item.command.commandId,result});send(item.client.socket,{type:'ACK',reply:result});changed.add(r.roomCode);}
    catch(e){rooms.set(r.roomCode,before);send(item.client.socket,{type:'ACK',reply:{commandId:item.command.commandId,status:'REJECTED',errorCode:'STORAGE_UNAVAILABLE',message:'저장하지 못했습니다. 같은 요청으로 다시 연결하세요.'}});console.error('Command commit failed:',(e as Error).message);}}
  for(const code of changed){const r=rooms.get(code);if(r)broadcast(r);}
  let catchup=0;
  while(accumulator>=50&&catchup++<5){const begin=performance.now();for(const r of rooms.values()){
      const previousPhase=r.phase;tickRoom(r);
      if((r.tick%20===0&&!['LOBBY','RESULT','CANCELLED'].includes(r.phase))||previousPhase!==r.phase){try{storage.save(r);}catch(e){r.paused=true;console.error('Checkpoint failed; room paused:',(e as Error).message);}}
      if(performance.now()-(lastBroadcast.get(r.roomCode)||0)>=100||previousPhase!==r.phase)broadcast(r);
    }metrics.push(performance.now()-begin);if(metrics.length>6000)metrics.shift();accumulator-=50;}
},10);
const heartbeat=setInterval(()=>{for(const c of clients){if(performance.now()-c.lastPongAt>=15000){c.socket.terminate();continue;}c.alive=false;c.socket.ping();}},5000);
const cleanup=setInterval(()=>{
  const expired=[...rooms.values()].filter(r=>['LOBBY','RESULT','CANCELLED'].includes(r.phase)&&Date.now()-Date.parse(r.updatedAt)>86400000&&![...clients].some(c=>c.roomCode===r.roomCode)).map(r=>r.roomCode);
  if(expired.length){const removed=storage.expireInactive(expired);for(const code of removed){rooms.delete(code);lastBroadcast.delete(code);}}
},60000);
server.listen(port,host,()=>console.log(`Class Clash ${dev?'development':'production'}: http://${host}:${port} (Node ${process.version}, SQLite WAL)`));
function shutdown(){clearInterval(timer);clearInterval(heartbeat);clearInterval(cleanup);for(const r of rooms.values())storage.save(r);for(const c of clients)c.socket.close();wss.close();server.close();void vite?.close();storage.close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
