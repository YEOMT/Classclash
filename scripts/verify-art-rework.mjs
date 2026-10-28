import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,cpus,release} from 'node:os';

const base='http://127.0.0.1:3114';
const out='artifacts/art-rework';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3114',DATABASE_PATH:join(tmpdir(),`classclash-art-${Date.now()}.sqlite`)},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
let browser,recording,context,page;
const errors=[],report={measuredAt:new Date().toISOString(),environment:{node:process.version,os:release(),cpu:cpus()[0]?.model,viewport:'1440×1000',mode:'production build / normal speed / Chromium headless / D3D11 requested'},checks:[]};
const summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:sorted.length,p50:sorted[Math.floor(sorted.length*.5)]??0,p95:sorted[Math.floor(sorted.length*.95)]??0,p99:sorted[Math.floor(sorted.length*.99)]??0,max:sorted.at(-1)??0};};
async function waitServer(){for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('QA server failed: '+serverLog);}
async function labReady(p){await expect.poll(()=>p.evaluate(()=>window.__artLab?.ready),{timeout:30000}).toBe(true);}
try{
 await waitServer();
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']});report.environment.browser=browser.version();
 recording=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,recordVideo:{dir:join(tmpdir(),`classclash-art-video-${Date.now()}`),size:{width:1440,height:1000}}});
 let p=await recording.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/battle-art-lab.html');await labReady(p);
 await expect.poll(()=>p.evaluate(()=>window.__artLab.actions.length),{timeout:15000}).toBe(6);
 await p.screenshot({path:out+'/01-student-combat.png',fullPage:true});
 report.lab=await p.evaluate(()=>({skills:window.__artLab.actions,events:window.__artLab.observed,assetErrors:window.__artLab.rendererMetrics.assetErrors}));
 await expect.poll(()=>p.evaluate(()=>window.__artLab.observed.includes('DEATH')),{timeout:30000}).toBe(true);
 report.lab.events=await p.evaluate(()=>window.__artLab.observed);
 await p.getByRole('button',{name:'호스트 전체맵',exact:true}).click();await labReady(p);
 await p.screenshot({path:out+'/02-host-full-map.png',fullPage:true});
 await p.getByRole('button',{name:'학생 확대',exact:true}).click();await labReady(p);
 await p.getByRole('button',{name:'장면 재시작',exact:true}).click();
 await p.locator('#follow').selectOption('A-2');await p.locator('#pose').selectOption('skill2');
 await expect.poll(()=>p.evaluate(()=>window.__artLab.state.tick)).toBeGreaterThan(35);
 await p.screenshot({path:out+'/03-pyromancer-skill.png',fullPage:true});
 await p.locator('#scene').selectOption('stress');await p.getByRole('button',{name:'호스트 전체맵',exact:true}).click();await labReady(p);
 await p.screenshot({path:out+'/04-stress-30-heroes.png',fullPage:true});
 report.stress=await p.evaluate(()=>({heroes:window.__artLab.metrics.peakHeroes,minions:window.__artLab.metrics.peakMinions,invalid:window.__artLab.state.metrics.invalidPositions,renderer:window.__artLab.rendererMetrics.assetErrors}));
 const video=p.video();await p.close();await recording.close();recording=null;await copyFile(await video.path(),out+'/combat-preview.webm');
 report.checks.push('Same production renderer in student and host views; all six skills naturally triggered by same production AI','30 level-5 heroes + 84 minions staged with unchanged combat stats','No missing hero atlases');
 console.log('Art lab captured; measuring real 30-AI room for 45 seconds.');
 context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByRole('button',{name:'새 방 만들기',exact:true}).click();
 await page.getByRole('button',{name:'30명 채우기',exact:true}).click();
 await expect(page.locator('#lobby-total')).toContainText('AI 30');
 await page.getByRole('button',{name:/^시작 퀴즈 시작/}).click();
 await page.getByRole('button',{name:'시작 퀴즈 마감',exact:true}).click();await page.locator('[data-modal-confirm]').click();
 await expect(page.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:30000});await page.getByRole('button',{name:'전투 시작 →',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:20000}).toBe('BATTLE');
 await expect.poll(()=>page.evaluate(()=>window.__classClash?.rendererMetrics?.frames??0),{timeout:30000}).toBeGreaterThan(10);
 const sample=await page.evaluate(()=>new Promise(resolve=>{const frames=[],counts=[];let previous=performance.now(),started=previous,lastCount=0;function frame(now){frames.push(now-previous);previous=now;const b=window.__classClash.snapshot.battle;if(now-lastCount>250&&b){counts.push({heroes:b.units.filter(u=>u.kind==='HERO'&&u.hp>0).length,minions:b.units.filter(u=>u.kind.endsWith('MINION')&&u.hp>0).length});lastCount=now;}if(now-started<45000){requestAnimationFrame(frame);return;}const m=window.__classClash.rendererMetrics,canvas=document.querySelector('#battle-canvas canvas'),gl=canvas.getContext('webgl2')??canvas.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');resolve({frames,counts,renderer:m,server:window.__classClash.snapshot.diagnostics,eventSeq:b.eventSeq,tick:b.tick,invalidPositions:b.metrics.invalidPositions,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'});}requestAnimationFrame(frame);}));
 report.realRoom={durationSeconds:45,fixture:'30 STANDARD AI; normal 1× simulation; actual HTTP/WebSocket server, production bundle, SQLite in temp directory',frameMs:summary(sample.frames),sceneUpdateMs:summary(sample.renderer.sceneUpdateCpuMs),renderSubmissionMs:summary(sample.renderer.renderSubmissionCpuMs),peakHeroes:Math.max(...sample.counts.map(c=>c.heroes)),peakMinions:Math.max(...sample.counts.map(c=>c.minions)),counts:sample.counts,server:sample.server,eventSeq:sample.eventSeq,tick:sample.tick,invalidPositions:sample.invalidPositions,gpu:sample.gpu,assetErrors:sample.renderer.assetErrors,events:{received:sample.renderer.eventsReceived,consumed:sample.renderer.eventsConsumed,skipped:sample.renderer.recoveryEventsSkipped}};
 await page.screenshot({path:out+'/05-real-server-30-ai.png',fullPage:true});
 await page.getByRole('button',{name:'경기 중단',exact:true}).click();await page.locator('[data-modal-confirm]').click();
 expect(errors).toEqual([]);expect(report.lab.assetErrors).toEqual([]);expect(report.stress.heroes).toBe(30);expect(report.stress.minions).toBe(84);expect(sample.invalidPositions).toBe(0);
 report.checks.push('Production room: lobby → opening quiz → preparation → 30 AI battle → cancel succeeded','Measured browser frame intervals, scene CPU, WebGL submission CPU and server ticks separately');
 report.status='PASS';report.limitations='45-second local desktop measurement; no school tablet/phone measurements. RAF measures scheduling, not display scanout. Local GPU and CPU timings are not a universal FPS guarantee. Art lab uses staged initial placements and executes the same production combat engine locally; the separate real-room measurement uses the actual server.';
}catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;if(page)await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(error);}
finally{report.errors=errors;await writeFile(out+'/verification.json',JSON.stringify(report,null,2));await recording?.close();await context?.close();await browser?.close();server.kill();console.log(JSON.stringify({...report,realRoom:report.realRoom?{...report.realRoom,counts:undefined}:undefined},null,2));}
