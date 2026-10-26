import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function phase(page:Page){return page.evaluate(()=>window.__classClash?.snapshot?.phase);}
async function startBotRound(host:Page,round:number){
  await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
  await expect.poll(()=>phase(host),{timeout:45000}).toBe('INITIAL_MAINTENANCE');
  await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:45000});
  await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
  await expect.poll(()=>phase(host)).toBe('BATTLE');
  await expect.poll(()=>host.evaluate(()=>window.__classClash?.rendererMetrics?.frames||0)).toBeGreaterThan(10);
  if(round===0){await host.waitForTimeout(4000);await host.screenshot({path:'artifacts/screenshots/10-ai30-real-battle.png',fullPage:true});}
  await expect.poll(()=>phase(host),{timeout:300000,intervals:[500]}).toBe('RESULT');
  await host.waitForTimeout(7600);
  const result=await host.evaluate(()=>window.__classClash.snapshot.result);
  expect(result.cancelled).toBe(false);expect(['A','B','DRAW']).toContain(result.winner);expect(result.awards).toHaveLength(7);expect(result.players).toHaveLength(30);
  expect(result.players.every((p:any)=>p.stats.earned===p.stats.correct)).toBe(true);
  await host.screenshot({path:`artifacts/screenshots/11-ai30-awards-round-${round+1}.png`,fullPage:true});
  return result;
}
test('AI30 completes three consecutive real nexus-destruction matches and all awards',async({page})=>{
  test.setTimeout(950000);await mkdir('artifacts/screenshots',{recursive:true});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.getByRole('button',{name:'새 방 만들기'}).click();await page.getByRole('button',{name:'30명 채우기'}).click();await expect(page.locator('.player-row')).toHaveCount(30);
  const results=[];
  for(let i=0;i<3;i++){
    results.push(await startBotRound(page,i));
    if(i<2){await page.getByRole('button',{name:/같은 참가자로 재경기/}).click();await expect.poll(()=>phase(page)).toBe('LOBBY');
      const cleared=await page.evaluate(()=>window.__classClash.snapshot);expect(cleared.result).toBeNull();expect(cleared.battle).toBeNull();expect(cleared.matchId).toBeNull();expect(cleared.players.every((p:any)=>p.state==='WAITING'&&p.level===0&&!p.activeEntityId)).toBe(true);
    }
  }
  expect(new Set(results.map(x=>x.matchId)).size).toBe(3);expect(errors).toEqual([]);
  await writeFile('artifacts/browser-three-rematches.json',JSON.stringify({status:'PASS',mode:'actual browser, server-authoritative, test scheduler acceleration visibly labeled',results,errors},null,2));
});

test('one human +29 AI completes quiz, manual redeployment and human awards',async({browser,baseURL})=>{
  test.setTimeout(400000);await mkdir('artifacts/screenshots',{recursive:true});
  const hc=await browser.newContext({viewport:{width:1366,height:768}}),sc=await browser.newContext({viewport:{width:1280,height:800}});
  const host=await hc.newPage(),student=await sc.newPage(),errors:string[]=[];
  for(const p of [host,student])p.on('pageerror',e=>errors.push(e.message));
  try{
    await host.goto(baseURL!);await host.getByRole('button',{name:'새 방 만들기'}).click();
    const code=await host.locator('.topbar .room-code').innerText();
    await student.goto(`${baseURL}/?room=${code}`);await student.getByLabel('닉네임').fill('완주 검증 학생');await student.getByRole('button',{name:'전장에 참가하기'}).click();
    await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBeTruthy();
    const playerId=await student.evaluate(()=>window.__classClash.snapshot.self.playerId);
    await host.getByRole('button',{name:'30명 채우기'}).click();await expect(host.locator('.player-row')).toHaveCount(30);
    await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
    const answer=async()=>{await student.locator('.quiz-choice').first().click();await student.getByRole('button',{name:'답안 확정',exact:true}).click();};
    for(let i=0;i<20;i++){await answer();if(i<19)await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
    await student.locator('[data-action=starter][data-id=archer]').click();await student.getByRole('button',{name:'준비 완료',exact:true}).click();
    await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:45000});await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
    await expect.poll(()=>phase(student)).toBe('BATTLE');
    await student.getByRole('button',{name:/퀴즈 풀기 · 한 묶음 10문제/}).click();
    const attemptId=await student.evaluate(()=>window.__classClash.snapshot.self.quiz.attemptId);
    for(let i=0;i<6;i++){await answer();await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
    await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.players.find((p:any)=>p.playerId===window.__classClash.snapshot.self.playerId)?.state),{timeout:90000}).toBe('DEAD_MAINTENANCE');
    expect(await student.evaluate(()=>window.__classClash.snapshot.self.quiz.attemptId)).toBe(attemptId);
    await student.screenshot({path:'artifacts/screenshots/14-human-death-during-quiz.png',fullPage:true});
    await student.reload();await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBe(playerId);
    await student.getByRole('button',{name:/퀴즈 이어 풀기/}).click();
    for(let i=6;i<10;i++){await answer();if(i<9)await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
    await student.locator('[data-action=close-quiz]').click();
    const deploy=student.locator('[data-action=deploy]');await expect(deploy).toBeEnabled({timeout:20000});await deploy.click();
    await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.players.find((p:any)=>p.playerId===window.__classClash.snapshot.self.playerId)?.activeEntityId)).toBeTruthy();
    await host.screenshot({path:'artifacts/screenshots/15-human-and-29-ai-battle.png',fullPage:true});
    await expect.poll(()=>phase(host),{timeout:300000,intervals:[500]}).toBe('RESULT');await host.waitForTimeout(7600);
    const result=await host.evaluate(()=>window.__classClash.snapshot.result),human=result.players.find((p:any)=>p.playerId===playerId);
    expect(result.cancelled).toBe(false);expect(result.players).toHaveLength(30);expect(result.awards).toHaveLength(7);expect(human.stats.answered).toBe(30);expect(human.stats.deployments).toBe(2);
    expect(result.awards.every((a:any)=>a.playerIds.every((id:string)=>id===playerId))).toBe(true);expect(errors).toEqual([]);
    await host.screenshot({path:'artifacts/screenshots/16-human-and-29-ai-awards.png',fullPage:true});
    await writeFile('artifacts/browser-human29.json',JSON.stringify({status:'PASS',mode:'real browser UI; same engine; visibly labeled accelerated scheduler',playerId,attemptId,deathDuringQuiz:true,reconnected:true,manualDeployments:2,result,errors},null,2));
  }finally{await hc.close();await sc.close();}
});
