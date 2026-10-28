import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {connect} from 'node:net';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';

test('malformed WebSocket frame terminates only that peer and leaves HTTP authority alive',{timeout:20000},async t=>{
  const dir=mkdtempSync(join(tmpdir(),'clash-ws-frame-')),port=3196,base=`http://127.0.0.1:${port}`;
  const proc=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{windowsHide:true,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATABASE_PATH:join(dir,'test.sqlite'),NODE_ENV:'test',APP_ORIGIN:'',HOST_ACCESS_CODE:'',HOST_ACCESS_CODE_FILE:''},stdio:['ignore','pipe','pipe']});
  let log='';proc.stdout.on('data',x=>log+=x);proc.stderr.on('data',x=>log+=x);t.after(()=>proc.kill());
  let ready=false;for(let i=0;i<160;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready,log);
  const socket=connect(port,'127.0.0.1');t.after(()=>socket.destroy());
  await new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Malformed peer was not closed')),6000);let upgraded=false;
    socket.on('connect',()=>socket.write(`GET /ws HTTP/1.1\r\nHost:127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version:13\r\nSec-WebSocket-Key:${randomBytes(16).toString('base64')}\r\n\r\n`));
    socket.on('data',data=>{if(!upgraded){assert.ok(data.toString().includes('101'));upgraded=true;socket.write(Buffer.from([0x83,0x80,1,2,3,4]));}});
    socket.on('close',()=>{clearTimeout(timeout);resolve();});socket.on('error',reject);
  });
  assert.equal(proc.exitCode,null,'protocol error must not terminate the authoritative server');
  const response=await fetch(base+'/api/health');assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
});
