import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {cancelActiveTestMatch} from './cleanup.js';

async function phase(page:Page){return page.evaluate(()=>window.__classClash?.snapshot?.phase);}
async function startBotRound(host:Page,round:number){
  await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
  await expect.poll(()=>phase(host),{timeout:45000}).toBe('INITIAL_MAINTENANCE');
  await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:45000});
  await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
  await expect.poll(()=>phase(host)).toBe('BATTLE');
  await expect.poll(()=>host.evaluate(()=>window.__classClash?.rendererMetrics?.frames||0)).toBeGreaterThan(10);
  if(round===0){await host.waitForTimeout(4000);await host.screenshot({path:'artifacts/screenshots/10-ai30-real-battle.png',fullPage:true});}
  await expect.poll(()=>phase(host),{timeout:600000,intervals:[500]}).toBe('RESULT');
  if(round===0){await host.screenshot({path:'artifacts/screenshots/17-nexus-winner.png',fullPage:true});await host.waitForTimeout(3300);await host.screenshot({path:'artifacts/screenshots/18-team-summary.png',fullPage:true});await host.waitForTimeout(4400);}else await host.waitForTimeout(7600);
  const result=await host.evaluate(()=>window.__classClash.snapshot.result);
  expect(result.cancelled).toBe(false);expect(['A','B','DRAW']).toContain(result.winner);expect(result.awards).toHaveLength(7);expect(result.players).toHaveLength(30);
  expect(result.players.every((p:any)=>p.stats.earned===p.stats.correct)).toBe(true);
  expect(await host.evaluate(()=>window.__classClash.snapshot.battle.structures.some((s:any)=>s.kind==='NEXUS'&&s.hp<=0))).toBe(true);
  await expect(host.locator('.award-card')).toHaveCount(7);
  await host.screenshot({path:`artifacts/screenshots/11-ai30-awards-round-${round+1}.png`,fullPage:true});
  return result;
}
test('AI30 completes an initial match plus three consecutive real nexus-destruction rematches and all awards',async({page})=>{
  test.setTimeout(2800000);await mkdir('artifacts/screenshots',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'새 방 만들기'}).click();await page.getByRole('button',{name:'30명 채우기'}).click();await expect(page.locator('.player-row')).toHaveCount(30);
  const results=[],heaps:number[]=[];const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  try{
  for(let i=0;i<4;i++){
    results.push(await startBotRound(page,i));
    await cdp.send('HeapProfiler.collectGarbage');const memory=await cdp.send('Performance.getMetrics');heaps.push(memory.metrics.find((m:any)=>m.name==='JSHeapUsedSize')?.value||0);
    await writeFile('artifacts/browser-rematches-progress.json',JSON.stringify({status:'IN_PROGRESS',completedMatches:results.length,requiredMatches:4,postResultHeapBytesAfterGC:heaps,results},null,2));
    if(i===0){const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'실제 기록 JSON 저장'}).click();const download=await downloadEvent;await download.saveAs('artifacts/downloaded-match-result.json');expect(JSON.parse(await readFile('artifacts/downloaded-match-result.json','utf8'))).toEqual(results[0]);}
    if(i<3){await page.getByRole('button',{name:/같은 참가자로 재경기/}).click();await expect.poll(()=>phase(page)).toBe('LOBBY');
      const cleared=await page.evaluate(()=>window.__classClash.snapshot);expect(cleared.result).toBeNull();expect(cleared.battle).toBeNull();expect(cleared.matchId).toBeNull();expect(cleared.players.every((p:any)=>p.state==='WAITING'&&p.level===0&&!p.activeEntityId)).toBe(true);expect(cleared.hostStudents.every((p:any)=>p.gold===0&&p.inventory.length===0&&p.quiz===null&&p.deathId===null&&p.stats.deployments===0&&Object.keys(p.sharedSkillReadyAt).length===0)).toBe(true);
    }
  }
  expect(new Set(results.map(x=>x.matchId)).size).toBe(4);expect(errors).toEqual([]);
  await writeFile('artifacts/browser-three-rematches.json',JSON.stringify({status:'PASS',initialMatches:1,consecutiveRematches:3,totalMatches:4,gpuMode:process.env.CLASH_TEST_GPU||'default',mode:'actual browser, server-authoritative, test scheduler acceleration visibly labeled',postResultHeapBytesAfterGC:heaps,results,errors},null,2));
  }finally{await cancelActiveTestMatch(page).catch(()=>{});}
});

test('one human +29 AI completes quiz, manual redeployment and human awards',async({browser,baseURL})=>{
  test.setTimeout(700000);await mkdir('artifacts/screenshots',{recursive:true});
  const hc=await browser.newContext({viewport:{width:1366,height:768}}),sc=await browser.newContext({viewport:{width:1280,height:800}});
  const host=await hc.newPage(),student=await sc.newPage(),errors:string[]=[];
  let stage='create-and-join';
  const wire:unknown[]=[];
  student.on('websocket',ws=>{const record=(direction:string,frame:{payload:string|Buffer})=>{try{const message=JSON.parse(String(frame.payload));if(!['COMMAND','ACK','ERROR','WELCOME','REPLACED'].includes(message.type))return;const entry={at:new Date().toISOString(),stage,direction,message};wire.push(entry);if(wire.length>100)wire.shift();if(message.type==='ACK'&&message.reply?.status==='REJECTED'||message.type==='ERROR')console.error('[human29 wire]',JSON.stringify(entry));}catch{}};ws.on('framesent',frame=>record('sent',frame));ws.on('framereceived',frame=>record('received',frame));});
  for(const p of [host,student]){p.setDefaultTimeout(20000);p.setDefaultNavigationTimeout(30000);p.on('pageerror',e=>{errors.push(e.message);console.error(`[human29 ${stage}] pageerror: ${e.message}`);});}
  const progress=async(label:string)=>{stage=label;const state=await student.evaluate(()=>{const s=window.__classClash?.snapshot;return {phase:s?.phase,tick:s?.tick,playerState:s?.players.find((p:any)=>p.playerId===s?.self?.playerId)?.state,answered:s?.self?.stats.answered,deployments:s?.self?.stats.deployments,quiz:s?.self?.quiz&&{attemptId:s.self.quiz.attemptId,index:s.self.quiz.index,completed:s.self.quiz.completed,questionId:s.self.quiz.question?.id}};});console.log(`[human29 ${new Date().toISOString()}] ${label} ${JSON.stringify(state)}`);return state;};
  try{
    await host.goto(baseURL!);await host.getByRole('button',{name:'새 방 만들기'}).click();
    const code=await host.locator('.topbar .room-code').innerText();
    await student.goto(`${baseURL}/?room=${code}`);await student.getByLabel('닉네임').fill('완주 검증 학생');await student.getByRole('button',{name:'전장에 참가하기'}).click();
    await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBeTruthy();
    const playerId=await student.evaluate(()=>window.__classClash.snapshot.self.playerId);
    await host.getByRole('button',{name:'30명 채우기'}).click();await expect(host.locator('.player-row')).toHaveCount(30);
    await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
    const answer=async(label:string)=>{const before=await progress(`${label}: choose`);await student.locator('.quiz-choice').first().click();stage=`${label}: submit`;await student.getByRole('button',{name:'답안 확정',exact:true}).click();await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.stats.answered),{timeout:20000}).toBe((before.answered??0)+1);await progress(`${label}: accepted`);};
    const next=async(label:string)=>{await progress(`${label}: next`);await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();};
    for(let i=0;i<20;i++){await answer(`opening ${i+1}/20`);if(i<19)await next(`opening ${i+1}/20`);}
    await progress('starter and ready');
    await student.locator('[data-action=starter][data-id=archer]').click();await student.getByRole('button',{name:'준비 완료',exact:true}).click();
    await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:45000});await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
    await expect.poll(()=>phase(student)).toBe('BATTLE');
    await student.getByRole('button',{name:/퀴즈 풀기 · 한 묶음 10문제/}).click();
    await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.quiz?.total)).toBe(10);
    const attemptId=await student.evaluate(()=>window.__classClash.snapshot.self.quiz.attemptId);
    for(let i=0;i<6;i++){await answer(`battle ${i+1}/10`);await next(`battle ${i+1}/10`);}
    await progress('wait for death on question 7');
    await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.players.find((p:any)=>p.playerId===window.__classClash.snapshot.self.playerId)?.state),{timeout:90000}).toBe('DEAD_MAINTENANCE');
    expect(await student.evaluate(()=>window.__classClash.snapshot.self.quiz.attemptId)).toBe(attemptId);
    await student.screenshot({path:'artifacts/screenshots/14-human-death-during-quiz.png',fullPage:true});
    await student.reload();await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBe(playerId);
    await progress('reload and resume question 7');
    await student.getByRole('button',{name:/퀴즈 이어 풀기/}).click();
    for(let i=6;i<10;i++){await answer(`battle ${i+1}/10`);if(i<9)await next(`battle ${i+1}/10`);}
    await progress('quiz complete; close and manually redeploy');
    await student.locator('[data-action=close-quiz]').click();
    const deploy=student.locator('[data-action=deploy]');await expect(deploy).toBeEnabled({timeout:20000});await deploy.click();
    await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.players.find((p:any)=>p.playerId===window.__classClash.snapshot.self.playerId)?.activeEntityId)).toBeTruthy();
    await progress('second deployment; wait for nexus destruction');
    await host.screenshot({path:'artifacts/screenshots/15-human-and-29-ai-battle.png',fullPage:true});
    await expect.poll(()=>phase(host),{timeout:600000,intervals:[500]}).toBe('RESULT');await host.waitForTimeout(7600);
    const result=await host.evaluate(()=>window.__classClash.snapshot.result),human=result.players.find((p:any)=>p.playerId===playerId);
    expect(result.cancelled).toBe(false);expect(result.players).toHaveLength(30);expect(result.awards).toHaveLength(7);expect(human.stats.answered).toBe(30);expect(human.stats.deployments).toBe(2);
    expect(result.awards.every((a:any)=>a.playerIds.every((id:string)=>id===playerId))).toBe(true);expect(errors).toEqual([]);
    await host.screenshot({path:'artifacts/screenshots/16-human-and-29-ai-awards.png',fullPage:true});
    await student.reload();await expect.poll(()=>phase(student)).toBe('RESULT');expect(await student.evaluate(()=>window.__classClash.snapshot.result)).toEqual(result);
    await writeFile('artifacts/browser-human29.json',JSON.stringify({status:'PASS',mode:'real browser UI; same engine; visibly labeled accelerated scheduler',playerId,attemptId,deathDuringQuiz:true,reconnected:true,manualDeployments:2,result,errors},null,2));
  }catch(error){console.error(`[human29 failed at ${stage}]`,error);const state=await Promise.race([progress(`FAILED: ${stage}`).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve('state read timed out'),3000))]);await writeFile('artifacts/browser-human29-failure.json',JSON.stringify({status:'FAIL',stage,state,errors,wire,error:String(error)},null,2));await student.screenshot({path:'artifacts/screenshots/human29-failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;
  }finally{console.log(`[human29 cleanup] ${stage}`);await cancelActiveTestMatch(host).catch(()=>{});await hc.close();await sc.close();}
});
