import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';

test('30 standard AI normal-speed host rendering: five-minute observation',async({browser,baseURL})=>{
 test.setTimeout(540000);
 await mkdir('artifacts/screenshots',{recursive:true});
 const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
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
  const durations:number[]=[];
  for(let minute=0;minute<5;minute++){
   const sample=await page.evaluate(()=>new Promise<number[]>(resolve=>{const values:number[]=[];let previous=performance.now(),start=previous;function frame(now:number){values.push(now-previous);previous=now;if(now-start>=60000)resolve(values);else requestAnimationFrame(frame);}requestAnimationFrame(frame);}));durations.push(...sample);
   console.log('Five-minute host rendering observation:',minute+1,'/ 5 minutes');
  }
  const end=await page.evaluate(()=>({tick:window.__classClash.snapshot.tick,phase:window.__classClash.snapshot.phase,battle:window.__classClash.snapshot.battle,metrics:window.__classClash.rendererMetrics,userAgent:navigator.userAgent,webgl:document.querySelector('canvas')?.getContext('webgl2')?.getParameter(0x1f01)}));
  durations.sort((a,b)=>a-b);const percentile=(p:number)=>durations[Math.floor((durations.length-1)*p)]??0;
  const report={testId:'P03-browser-headless',status:errors.length||percentile(.95)>20?'FAIL':'PASS',command:'node node_modules/@playwright/test/cli.js test --config tests/e2e/performance.config.ts',environment:{os:os.release(),platform:os.platform(),cpu:os.cpus()[0]?.model,memoryBytes:os.totalmem(),node:process.version,browser:browser.version(),viewport:'1366x768',dpr:1,mode:'Vite development; normal speed; headless Chromium'},fixture:'30 STANDARD AI, 15 per team, 0 human participants; actual authoritative combat; five wall-clock minutes',start,end:{tick:end.tick,phase:end.phase,units:end.battle?.units.length,projectiles:end.battle?.projectiles.length,effects:end.battle?.effects.length,events:end.battle?.eventSeq,renderer:{...end.metrics,frameMs:undefined}},frames:durations.length,frameMs:{p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:durations.at(-1)},targetP95Ms:20,targetMet:percentile(.95)<=20,errors,limitations:'Headless Chromium on development computer. Not a school tablet or proof of physical GPU FPS. Server is a single local room during measurement.'};
  await writeFile('artifacts/browser-performance.json',JSON.stringify(report,null,2));
  await page.screenshot({path:'artifacts/screenshots/12-host-30-ai-five-minutes.png',fullPage:true});
  expect(errors).toEqual([]);expect(end.metrics.assetErrors).toEqual([]);expect(end.metrics.frames).toBeGreaterThan(1000);expect(end.tick-start.tick).toBeGreaterThan(5500);
  await page.getByRole('button',{name:'경기 중단',exact:true}).click();await page.locator('[data-modal-confirm]').click();
  await expect(page.getByRole('heading',{name:'경기가 중단되었습니다'})).toBeVisible();
  expect(percentile(.95),'P03 host frame interval p95 target (headless developer environment)').toBeLessThanOrEqual(20);
 }finally{await context.close();}
});

declare global {interface Window {__classClash:any}}


