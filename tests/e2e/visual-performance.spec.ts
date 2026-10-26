import {cancelFixture} from './cleanup.js';
import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

test('30 standard AI normal-speed host rendering: five-minute observation',async({browser,baseURL})=>{
 test.setTimeout(540000);
 await mkdir('artifacts/screenshots',{recursive:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 const serverHealth=await (await page.request.get(`${baseURL}/api/health`)).json();
 try{
  await page.goto(baseURL!);await page.getByRole('button',{name:'새 방 만들기'}).click();
  await page.getByRole('button',{name:'30명 채우기'}).click();
  await expect(page.locator('#lobby-total')).toContainText('사람 0 · AI 30');
  await page.screenshot({path:'artifacts/screenshots/10-host-30-ai-lobby.png',fullPage:true});
  await page.getByRole('button',{name:'시작 퀴즈 시작'}).click();
  await expect(page.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:120000});
  await page.getByRole('button',{name:'전투 시작 →',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:20000}).toBe('BATTLE');
  await expect.poll(()=>page.evaluate(()=>window.__classClash?.snapshot?.battle?.metrics.firstHitTick??0),{timeout:50000}).toBeGreaterThan(0);
  await page.screenshot({path:'artifacts/screenshots/11-host-30-ai-first-fight.png',fullPage:true});
  const start=await page.evaluate(()=>({tick:window.__classClash.snapshot.tick,matchId:window.__classClash.snapshot.matchId,roomCode:window.__classClash.snapshot.roomCode,events:window.__classClash.rendererMetrics.eventsReceived}));
  const durations:number[]=[];let endedEarly=false;
  for(let minute=0;minute<5;minute++){
   const sample=await page.evaluate(()=>new Promise<number[]>(resolve=>{const values:number[]=[];let previous=performance.now(),start=previous;function frame(now:number){values.push(now-previous);previous=now;if(now-start>=60000||window.__classClash.snapshot.phase!=='BATTLE')resolve(values);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));durations.push(...sample);
   console.log('Five-minute host rendering observation:',minute+1,'/ 5 minutes');if(await page.evaluate(()=>window.__classClash.snapshot.phase!=='BATTLE')){endedEarly=true;break;}
  }
  const end=await page.evaluate(()=>({tick:window.__classClash.snapshot.tick,phase:window.__classClash.snapshot.phase,diagnostics:window.__classClash.snapshot.diagnostics,battle:window.__classClash.snapshot.battle,metrics:window.__classClash.rendererMetrics,userAgent:navigator.userAgent,gpu:(()=>{const canvas=document.querySelector<HTMLCanvasElement>('#battle-canvas canvas'),gl=canvas?.getContext('webgl2')??canvas?.getContext('webgl'),ext=gl?.getExtension('WEBGL_debug_renderer_info');return ext?{renderer:gl!.getParameter(ext.UNMASKED_RENDERER_WEBGL),vendor:gl!.getParameter(ext.UNMASKED_VENDOR_WEBGL)}:null;})()}));
  durations.sort((a,b)=>a-b);const percentile=(p:number)=>durations[Math.floor((durations.length-1)*p)]??0;
  const cpu=(a:number[]|undefined)=>{const sorted=[...(a??[])].sort((a,b)=>a-b);return {samples:sorted.length,p50:sorted[Math.floor(sorted.length*.5)]??null,p95:sorted[Math.floor(sorted.length*.95)]??null,p99:sorted[Math.floor(sorted.length*.99)]??null};};
  const report={testId:'P03-browser-headless',status:errors.length||percentile(.95)>20||endedEarly||!end.metrics||end.metrics.assetErrors.length||end.tick-start.tick<=5500||end.metrics.eventsReceived!==end.metrics.eventsConsumed+end.metrics.recoveryEventsSkipped?'FAIL':'PASS',endedEarly,command:process.env.CLASH_TEST_GPU==='d3d11'?'node scripts/run-physical-perf.mjs':'node node_modules/@playwright/test/cli.js test --config tests/e2e/performance.config.ts',serverVersions:serverHealth.versions,environment:{os:os.release(),platform:os.platform(),cpu:os.cpus()[0]?.model,memoryBytes:os.totalmem(),node:process.version,browser:browser.version(),viewport:'1366x768',dpr:1,gpu:end.gpu,requestedGpu:process.env.CLASH_TEST_GPU??'default',mode:'Production bundle; normal speed; headless Chromium; SQLite in OS temporary directory'},fixture:'30 STANDARD AI, 15 per team, 0 human participants; actual authoritative combat; five wall-clock minutes',start,end:{tick:end.tick,phase:end.phase,units:end.battle?.units.length,projectiles:end.battle?.projectiles.length,effects:end.battle?.effects.length,events:end.battle?.eventSeq,renderer:{...end.metrics,frameMs:undefined,sceneUpdateCpuMs:undefined,renderSubmissionCpuMs:undefined}},server:{diagnostics:end.diagnostics,p95TargetMs:15,p99TargetMs:30,status:end.diagnostics?(end.diagnostics.tickP95<=15&&end.diagnostics.tickP99<=30?'PASS':'FAIL'):'NOT_RUN',scope:'P02 server timings reported separately from P03 browser frame target'},cpu:{sceneUpdateMs:cpu(end.metrics?.sceneUpdateCpuMs),renderSubmissionMs:cpu(end.metrics?.renderSubmissionCpuMs),scope:'JavaScript scene update and WebGL command submission measured separately; excludes asynchronous GPU/compositor cost.'},frames:durations.length,frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:durations.at(-1)},targetP95Ms:20,targetMet:percentile(.95)<=20,errors,limitations:'Headless Chromium on the development computer using the reported graphics adapter. RAF intervals and renderer submissions are measured; display scanout is not externally measured. Not a school-device test. Server is a single local room during measurement.'};
  await writeFile('artifacts/browser-performance.json',JSON.stringify(report,null,2));if(process.env.CLASH_TEST_GPU==='d3d11')await writeFile('artifacts/browser-performance-d3d11.json',JSON.stringify(report,null,2));
  await page.screenshot({path:'artifacts/screenshots/12-host-30-ai-five-minutes.png',fullPage:true});
  expect(errors).toEqual([]);expect(endedEarly,'Match must remain in actual combat for the entire five-minute sample').toBe(false);expect(end.metrics?.assetErrors).toEqual([]);expect(end.metrics?.frames??0).toBeGreaterThan(1000);expect(end.tick-start.tick).toBeGreaterThan(5500);expect(end.metrics?.eventsReceived).toBe((end.metrics?.eventsConsumed??0)+(end.metrics?.recoveryEventsSkipped??0));
  await page.getByRole('button',{name:'경기 중단',exact:true}).click();await page.locator('[data-modal-confirm]').click();
  await expect(page.getByRole('heading',{name:'경기가 중단되었습니다'})).toBeVisible();
  expect(percentile(.95),'P03 host frame interval p95 target (headless developer environment)').toBeLessThanOrEqual(20);
 }finally{await cancelFixture(page);await context.close();}
});

declare global {interface Window {__classClash:any}}


