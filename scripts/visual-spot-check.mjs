import {cancelFixture} from '../tests/e2e/cleanup.ts';
import {chromium,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';import {join} from 'node:path';import {tmpdir} from 'node:os';
import WebSocket from 'ws';
const withoutRenderer=process.argv.includes('--no-render');
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3000',DATABASE_PATH:join(tmpdir(),`class-clash-spot-${Date.now()}.sqlite`),CLASH_TEST_SPEED:'1',CLASH_DIAGNOSTICS:'1'},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',data=>console.log('SERVER',String(data).trim()));server.stderr.on('data',data=>console.log('SERVER ERROR',String(data).trim()));
let browser,context,page;const errors=[],wire=[];
try{
 for(let n=0;n<60;n++){try{if((await fetch('http://127.0.0.1:3000/api/health')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));if(n===59)throw new Error('Server did not become healthy');}
 browser=await chromium.launch();context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});page=await context.newPage();page.setDefaultTimeout(20000);
 await page.addInitScript(()=>{const Original=window.WebSocket;window.WebSocket=class extends Original{constructor(...args){super(...args);this.addEventListener('close',event=>console.log('NATIVE WS CLOSE',event.code,event.reason));}};});
 page.on('console',message=>{if(message.text().startsWith('NATIVE WS'))console.log(message.text());});
 page.on('pageerror',error=>{errors.push(error.message);console.error('PAGE ERROR',error.message);});
 page.on('response',response=>{if(/heroes\/.*\.png/.test(response.url()))console.log('ASSET',response.status(),response.url().split('/').at(-1),new Date().toISOString());});
 page.on('requestfailed',request=>console.log('REQUEST FAILED',request.url().split('/').at(-1),request.failure()?.errorText));
 page.on('websocket',ws=>{let phase='';ws.on('framereceived',frame=>{try{const m=JSON.parse(String(frame.payload));if(m.type==='SNAPSHOT'){if(m.snapshot.phase!==phase){phase=m.snapshot.phase;const record={at:new Date().toISOString(),phase,tick:m.snapshot.tick,seq:m.snapshot.snapshotSeq,epoch:m.snapshot.connectionEpoch};wire.push(record);console.log('WIRE',JSON.stringify(record));}}else if(['WELCOME','ERROR','REPLACED'].includes(m.type)){console.log('WIRE',m.type,m.connectionEpoch??m.errorCode??'');}}catch{}});ws.on('close',()=>console.log('WS CLOSED'));});
 await mkdir('artifacts/screenshots',{recursive:true});
 await page.goto(`http://127.0.0.1:3000${withoutRenderer?'/?diagnosticRender=0':''}`);await page.getByRole('button',{name:'새 방 만들기'}).click();await page.getByRole('button',{name:'30명 채우기'}).click();
 await expect(page.locator('#lobby-total')).toContainText('AI 30',{timeout:30000});await page.getByRole('button',{name:'시작 퀴즈 시작'}).click();
 await page.getByRole('button',{name:'시작 퀴즈 마감',exact:true}).click();await page.locator('[data-modal-confirm]').click();
 await expect(page.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'전투 시작 →',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:20000}).toBe('BATTLE');
 await expect.poll(()=>page.evaluate(()=>window.__classClash?.snapshot?.battle?.metrics.firstHitTick??0),{timeout:40000}).toBeGreaterThan(0);
 if(withoutRenderer){console.log('NO-RENDER DIAGNOSTIC BATTLE AND FIRST HIT',JSON.stringify(await page.evaluate(()=>({phase:window.__classClash?.snapshot?.phase,tick:window.__classClash?.snapshot?.tick,metrics:window.__classClash?.snapshot?.diagnostics}))));}
 else{
 await page.getByRole('button',{name:'AI 관찰',exact:true}).click();await expect(page.locator('#inspector-content .inspector-hero')).not.toHaveCount(0);
 await expect.poll(()=>page.locator('#battle-canvas canvas').evaluate(c=>Math.abs(c.height-c.clientHeight))).toBeLessThanOrEqual(1);
 await page.screenshot({path:'artifacts/screenshots/14-host-inspector-full-map-resized.png',fullPage:true});
 await page.getByRole('button',{name:'경기 중단',exact:true}).click();await page.locator('[data-modal-confirm]').click();await expect(page.getByRole('heading',{name:'경기가 중단되었습니다'})).toBeVisible();
 await page.goto('http://127.0.0.1:3000/art-gallery.html');await expect(page.locator('canvas')).toHaveCount(18);await expect(page.locator('#status')).toContainText('18');
 await page.screenshot({path:'artifacts/screenshots/15-all-18-hero-gallery.png',fullPage:true});expect(errors).toEqual([]);
 await writeFile('artifacts/visual-spot-check.json',JSON.stringify({status:'PASS',checks:['Host forced early opening-quiz close confirmation','30 AI starter readiness with earned assets only','Real combat first hit','Read-only AI quiz/inventory pane','Canvas backing size follows observer panel layout','All 18 real atlas gallery canvases','No page errors'],note:'Short visual fixture deliberately closes the opening quiz early using the host command. Not a duration/performance fixture.',errors,wire},null,2));
 }
}catch(error){console.error(error);if(page){await page.screenshot({path:'artifacts/screenshots/spot-check-failure.png'}).catch(()=>{});const state=await page.evaluate(()=>({phase:window.__classClash?.snapshot?.phase,tick:window.__classClash?.snapshot?.tick,epoch:window.__classClash?.snapshot?.connectionEpoch,seq:window.__classClash?.snapshot?.snapshotSeq,connected:document.body.dataset.connected,renderer:window.__classClash?.rendererMetrics})).catch(()=>null);await writeFile('artifacts/visual-spot-check-failure.json',JSON.stringify({status:'FAIL',error:String(error),state,wire,errors},null,2));console.log('CLIENT',JSON.stringify(state,(key,value)=>['frameMs','sceneUpdateCpuMs','renderSubmissionCpuMs'].includes(key)?undefined:value));}process.exitCode=1;
}finally{if(page&&process.exitCode){const session=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('classclash:active')??'null')).catch(()=>null);if(session){await new Promise(resolve=>{const socket=new WebSocket('ws://127.0.0.1:3000/ws',{perMessageDeflate:false});const timeout=setTimeout(()=>{socket.terminate();resolve();},10000);socket.on('open',()=>socket.send(JSON.stringify({type:'HELLO',roomCode:session.roomCode,token:session.token})));socket.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='SNAPSHOT'){console.log('NODE WS PROBE',m.snapshot.phase,m.snapshot.tick,m.snapshot.connectionEpoch);clearTimeout(timeout);socket.close();resolve();}});socket.on('error',()=>{clearTimeout(timeout);resolve();});});}}if(page)await cancelFixture(page);await context?.close();await browser?.close();server.kill();}
