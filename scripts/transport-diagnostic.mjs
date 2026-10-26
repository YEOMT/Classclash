import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
const port=3199,base=`http://127.0.0.1:${port}`,start=Date.now(),records=[];
const record=(kind,data)=>{records.push({wall:(Date.now()-start)/1000,kind,data});console.log(kind,JSON.stringify(data));};
const server=spawn(process.execPath,['dist/server.js'],{env:{...process.env,PORT:String(port),DATABASE_PATH:process.env.DIAG_MEMORY==='1'?':memory:':join(tmpdir(),`classclash-transport-${Date.now()}.sqlite`),CLASH_DIAGNOSTICS:'1',NODE_ENV:'test',CLASH_TEST_SPEED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
server.stdout.on('data',x=>record('server',String(x)));server.stderr.on('data',x=>record('server-error',String(x)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws,snapshot,lastLogged=0;
async function until(fn,ms=20000){const began=Date.now();while(!fn()){if(Date.now()-began>ms)throw new Error('Timeout');await sleep(25);}}
const pending=new Map();
async function command(type,payload={}){const command={commandId:randomUUID(),type,payload,matchId:snapshot.matchId,expectedPhaseRevision:snapshot.phaseRevision,connectionEpoch:snapshot.connectionEpoch};const promise=new Promise(resolve=>pending.set(command.commandId,resolve));ws.send(JSON.stringify({type:'COMMAND',command}));const ack=await Promise.race([promise,sleep(10000).then(()=>{throw new Error('ACK timeout '+type)})]);if(ack.status==='REJECTED')throw new Error(JSON.stringify(ack));return ack;}
try{
 await until(async()=>true);for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(100);}
 const session=await(await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:randomUUID()})})).json();
 ws=new WebSocket(base.replace('http','ws')+'/ws');ws.on('open',()=>ws.send(JSON.stringify({type:'HELLO',...session})));ws.on('error',e=>record('error',String(e)));ws.on('close',(code,reason)=>record('close',{code,reason:String(reason)}));
 ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='ACK')pending.get(m.reply.commandId)?.(m.reply);if(m.type==='SNAPSHOT'){snapshot=m.snapshot;if(Date.now()-lastLogged>900){lastLogged=Date.now();record('snapshot',{phase:snapshot.phase,tick:snapshot.tick,entities:snapshot.battle?.units.length,bytes:raw.length});}if(snapshot.battle)ws.send(JSON.stringify({type:'EVENT_ACK',lastEventSeq:snapshot.battle.eventSeq}));}});
 await until(()=>snapshot);await command('ADD_BOTS',{count:30});await sleep(100);await command('START_OPENING_QUIZ');await sleep(100);await command('CLOSE_OPENING_QUIZ');await until(()=>snapshot.players.every(p=>p.state==='READY'),30000);await command('START_COUNTDOWN');await until(()=>snapshot.phase==='BATTLE',30000);record('battle-start',{tick:snapshot.tick});await sleep(30000);if(snapshot.phase!=='BATTLE'||snapshot.tick-snapshot.battleStartTick<400)throw new Error('Server failed to progress20seconds');record('PASS',{tick:snapshot.tick,diagnostics:snapshot.diagnostics});await command('CANCEL_MATCH');
}catch(error){record('FAIL',String(error));process.exitCode=1;}finally{ws?.close();server.kill();writeFileSync('artifacts/transport-diagnostic.json',JSON.stringify(records,null,2));}
