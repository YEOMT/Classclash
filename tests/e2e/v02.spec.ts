import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const snap=(page:Page)=>page.evaluate(()=>window.__classClash.snapshot);
async function answer(page:Page,number:number){await page.locator('.quiz-choice').filter({hasText:'확인한 정답'}).click();await page.locator('[data-action=submit-answer]').click();await expect.poll(async()=>(await snap(page)).self.stats.answered).toBe(number);}
test('LOL 0.2: human+29 AI full flow, death during quiz, independent growth, reconnect and THREE consecutive rematches',async({browser,baseURL})=>{
 await mkdir('artifacts/v02/e2e',{recursive:true});
 const live=async(stage:string,match:number)=>{console.log(JSON.stringify({stage,match:match+1,at:new Date().toISOString()}));await writeFile('artifacts/v02/e2e/live.json',JSON.stringify({stage,match:match+1,completed:matches.length,at:new Date().toISOString()}));};
 const hc=await browser.newContext({viewport:{width:1366,height:768}}),sc=await browser.newContext({viewport:{width:1280,height:900}}),host=await hc.newPage(),student=await sc.newPage(),errors:string[]=[],matches:any[]=[];
 for(const p of[host,student])p.on('pageerror',error=>errors.push(error.message));
 try{
 await host.goto(baseURL!);await host.getByRole('button',{name:'새 방 만들기'}).click();const code=await host.locator('.topbar .room-code').innerText();
 await student.goto(`${baseURL}/?room=${code}`);await student.getByLabel('닉네임').fill('통합 검증 학생');await student.getByRole('button',{name:'전장에 참가하기'}).click();
 await host.locator('[data-action=fill][data-count="30"]').click();await expect(host.locator('.player-row')).toHaveCount(30);
 await host.locator('.quiz-config summary').click();await host.locator('#bank-input').fill(Array.from({length:30},(_,i)=>`교실 확인 문항 ${i+1} | 확인한 정답 | 다른 보기 A | 다른 보기 B | 다른 보기 C`).join('\n'));await host.locator('[data-action=save-bank]').click();await expect(host.locator('#bank-result')).toContainText('저장되었습니다');await expect.poll(async()=>(await snap(host)).quizBankCount).toBe(30);
 await host.screenshot({path:'artifacts/v02/e2e/01-lobby.png',fullPage:true});
 const identity=await (await host.request.get(baseURL+'/api/health')).json();
 for(let match=0;match<4;match++){
  await live('opening',match);
  await host.locator('[data-action=start-opening]').click();
  for(let i=0;i<20;i++){await answer(student,i+1);if(i<19)await student.locator('[data-action=next-question]').click();}
  await student.locator('[data-action=starter][data-id=brawler]').click();await expect(student.locator('[data-action=select-lane]')).toHaveCount(4);
  await student.locator('[data-action=level-up]').click();await expect.poll(async()=>(await snap(student)).self.inventory[0].level).toBe(2);
  await student.locator('[data-action=enhance-power]').click();await expect.poll(async()=>(await snap(student)).self.inventory[0].powerEnhancements).toBe(1);
  await student.locator('[data-action=draw-normal]').click();await expect.poll(async()=>(await snap(student)).self.inventory.length).toBe(2);
  let s=await snap(student);const first=s.self.inventory[0],second=s.self.inventory[1];expect(first.level).toBe(2);expect(second.level).toBe(1);
  await student.locator('[data-lane=MID]').click();await expect.poll(async()=>(await snap(student)).self.selectedLane).toBe('MID');
  if(match===0)await student.screenshot({path:'artifacts/v02/e2e/02-maintenance.png',fullPage:true});
  await live('prepared',match);await student.locator('[data-action=ready]').click();await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:90000});await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
  await expect.poll(async()=>(await snap(host)).phase).toBe('BATTLE');await expect.poll(()=>host.evaluate(()=>window.__classClash.rendererMetrics?.frames??0)).toBeGreaterThan(20);
  await student.locator('[data-action=open-quiz]').click();await student.locator('.quiz-choice').filter({hasText:'확인한 정답'}).click();
  await live('battle-quiz-held',match);s=await snap(student);const heldQuestion=s.self.quiz.question.id,heldAttempt=s.self.quiz.attemptId,playerId=s.self.playerId;
  if(match===0){await host.screenshot({path:'artifacts/v02/e2e/03-host-1366.png',fullPage:true});await host.setViewportSize({width:1920,height:1080});await host.waitForTimeout(500);await host.screenshot({path:'artifacts/v02/e2e/04-host-1920.png',fullPage:true});await student.screenshot({path:'artifacts/v02/e2e/05-student-quiz.png',fullPage:true});}
  await expect.poll(async()=>{const x=await snap(student);return x.players.find((p:any)=>p.playerId===playerId).state;},{timeout:250000}).toBe('DEAD_MAINTENANCE');
  await live('death-during-quiz',match);s=await snap(student);expect(s.self.quiz.question.id).toBe(heldQuestion);expect(s.self.quiz.attemptId).toBe(heldAttempt);await expect(student.locator('.quiz-choice.selected')).toContainText('확인한 정답');
  await student.reload();await expect.poll(async()=>(await snap(student))?.self?.playerId).toBe(playerId);await student.locator('[data-action=open-quiz]').click();await expect(student.locator('.quiz-choice.selected')).toContainText('확인한 정답');
  for(let i=0;i<10;i++){await answer(student,21+i);if(i<9)await student.locator('[data-action=next-question]').click();}
  await student.locator('[data-action=close-quiz]').click();await student.locator(`[data-action=select-hero][data-id="${second.ownedHeroInstanceId}"]`).click();await expect.poll(async()=>(await snap(student)).self.selectedOwnedHeroId).toBe(second.ownedHeroInstanceId);
  s=await snap(student);expect(s.self.inventory.find((h:any)=>h.ownedHeroInstanceId===first.ownedHeroInstanceId).level).toBe(2);expect(s.self.inventory.find((h:any)=>h.ownedHeroInstanceId===second.ownedHeroInstanceId).level).toBe(1);
  await student.locator('[data-lane=JUNGLE]').click();await expect.poll(async()=>(await snap(student)).self.selectedLane).toBe('JUNGLE');
  await expect(student.locator('[data-action=deploy]')).toBeEnabled({timeout:30000});await student.locator('[data-action=deploy]').click();await expect.poll(async()=>(await snap(student)).self.stats.deployments).toBe(2);
  await expect(student.locator('[data-action=select-lane]')).toHaveCount(0);await expect(student.locator('[data-action=draw-normal]')).toHaveCount(0);
  if(match===0){await student.setViewportSize({width:390,height:844});await student.locator('[data-action=open-quiz]').click({timeout:40000});await expect(student.locator('.quiz-card')).toBeVisible();await student.screenshot({path:'artifacts/v02/e2e/06-mobile.png',fullPage:true});expect(await student.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2)).toBe(true);await student.locator('[data-action=close-quiz]').click();await student.setViewportSize({width:1280,height:900});}
  await live('manual-jungle-redeploy-complete',match);let lastHostMetrics:any=null,lastStudentMetrics:any=null;await expect.poll(async()=>{const h=await host.evaluate(()=>window.__classClash.rendererMetrics),s=await student.evaluate(()=>window.__classClash.rendererMetrics);if(h)lastHostMetrics=h;if(s)lastStudentMetrics=s;return(await snap(host)).phase;},{timeout:900000,intervals:[1000]}).toBe('RESULT');expect(lastHostMetrics?.assetErrors).toEqual([]);expect(lastStudentMetrics?.assetErrors).toEqual([]);await live('nexus-destroyed',match);await host.waitForTimeout(8000);
  const final=await snap(host);expect(final.result.cancelled).toBe(false);expect(final.result.players).toHaveLength(30);expect(final.result.awards).toHaveLength(7);expect(final.battle.structures.some((u:any)=>u.kind==='NEXUS'&&u.hp<=0)).toBe(true);await expect(host.locator('.award-card')).toHaveCount(7);
  matches.push({matchId:final.matchId,result:final.result,assetErrors:lastHostMetrics.assetErrors,studentAssetErrors:lastStudentMetrics.assetErrors,renderedFrames:{host:lastHostMetrics.frames,student:lastStudentMetrics.frames},memory:await host.evaluate(()=>(performance as any).memory?.usedJSHeapSize??null)});
  await host.screenshot({path:`artifacts/v02/e2e/result-${match+1}.png`,fullPage:true});await host.reload();await expect.poll(async()=>(await snap(host))?.result?.matchId).toBe(final.result.matchId);
  await writeFile('artifacts/v02/e2e/progress.json',JSON.stringify({completed:matches.length,matches,errors},null,2));
  if(match<3){await host.locator('[data-action=rematch]').click();await expect.poll(async()=>(await snap(host)).phase).toBe('LOBBY');await expect(host.locator('.player-row')).toHaveCount(30);s=await snap(student);expect(s.self.gold).toBe(0);expect(s.self.inventory).toHaveLength(0);expect(s.matchId).not.toBe(final.matchId);}
 }
 expect(new Set(matches.map(m=>m.matchId)).size).toBe(4);expect(errors).toEqual([]);expect(matches.every(m=>m.assetErrors.length===0)).toBe(true);
 await writeFile('artifacts/v02/e2e/result.json',JSON.stringify({status:'PASS',mode:'Actual HTTP/WebSocket+Chromium; test scheduler4x, NOT performance benchmark',identity,completedMatches:4,consecutiveRematches:3,matches,errors},null,2));
 }catch(error){await writeFile('artifacts/v02/e2e/failure.json',JSON.stringify({error:String(error),matches,errors,host:await snap(host).catch(()=>null),student:await snap(student).catch(()=>null)},null,2));throw error;}finally{await hc.close();await sc.close();}
});
