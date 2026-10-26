import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('host + human + 29 AI: real lobby, quiz, maintenance, combat and reconnect', async ({ browser, baseURL }) => {
 test.setTimeout(240000);
 await mkdir('artifacts/screenshots',{recursive:true});
 const hostContext=await browser.newContext({viewport:{width:1366,height:768}});
 const studentContext=await browser.newContext({viewport:{width:1280,height:800}});
 const host=await hostContext.newPage(),student=await studentContext.newPage();
 host.setDefaultTimeout(15000);student.setDefaultTimeout(15000);const errors:string[]=[];
 for(const page of [host,student])page.on('pageerror',error=>errors.push(error.message));
 try{
 await host.goto(baseURL!);
 await expect(host.getByRole('heading',{name:'배운 만큼 성장하고, 함께 승리하세요.'})).toBeVisible();
 await host.screenshot({path:'artifacts/screenshots/01-entry.png',fullPage:true});
 await host.getByRole('button',{name:'새 방 만들기'}).click();
 await expect(host.getByRole('heading',{name:'오늘의 전장'})).toBeVisible();
 const roomCode=await host.locator('.topbar .room-code').innerText();
 await student.goto(`${baseURL}/?room=${roomCode}`);
 await student.getByLabel('닉네임').fill('검증 학생');
 await student.getByRole('button',{name:'전장에 참가하기'}).click();
 await expect(student.getByText('참가가 완료되었습니다.')).toBeVisible();
 await host.getByRole('button',{name:'30명 채우기'}).click();
 await expect(host.locator('#lobby-total')).toContainText('사람 1 · AI 29');
 await expect(host.locator('.player-row')).toHaveCount(30);
 await host.screenshot({path:'artifacts/screenshots/02-host-lobby-1-human-29-ai.png',fullPage:true});
 await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
 await expect(student.locator('.quiz-question')).toBeVisible();
 await student.screenshot({path:'artifacts/screenshots/03-student-opening-quiz.png',fullPage:true});
 for(let i=0;i<20;i++){
  console.log('Submitting opening question',i+1);
  await expect(student.locator('.quiz-choice').first()).toBeVisible();
  await student.locator('.quiz-choice').first().click();
  await student.getByRole('button',{name:'답안 확정',exact:true}).click();
  if(i<19){await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
 }
 await expect(student.getByText('첫 영웅은 무료로 선택하세요.')).toBeVisible({timeout:100000});
 await student.locator('[data-action=starter][data-id=archer]').click();
 await expect(student.getByRole('button',{name:'준비 완료',exact:true})).toBeVisible();
 await student.screenshot({path:'artifacts/screenshots/04-student-maintenance.png',fullPage:true});
 await student.getByRole('button',{name:'준비 완료',exact:true}).click();
 await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:30000});
 await host.screenshot({path:'artifacts/screenshots/05-host-ready.png',fullPage:true});
 await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
 await expect.poll(()=>host.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:20000}).toBe('BATTLE');
 await expect.poll(()=>host.evaluate(()=>window.__classClash?.snapshot?.battle?.metrics?.firstHitTick),{timeout:40000}).not.toBeNull();
 await expect.poll(()=>host.evaluate(()=>window.__classClash?.rendererMetrics?.frames??0),{timeout:15000}).toBeGreaterThan(50);
 expect(await host.evaluate(()=>window.__classClash?.rendererMetrics?.assetErrors)).toEqual([]);
 await host.screenshot({path:'artifacts/screenshots/06-host-full-map-combat.png',fullPage:true});
 await student.screenshot({path:'artifacts/screenshots/07-student-follow-combat.png',fullPage:true});
 const before=await student.evaluate(()=>({id:window.__classClash?.snapshot?.self?.playerId,active:window.__classClash?.snapshot?.players.find((p:any)=>p.playerId===window.__classClash?.snapshot?.self?.playerId)?.activeEntityId}));
 await student.reload();
 await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBe(before.id);
 await expect(student.locator('#battle-canvas canvas')).toBeVisible();
 await student.getByRole('button',{name:/퀴즈 풀기 · 한 묶음 10문제/}).click();
 await expect(student.locator('.quiz-choice')).toHaveCount(4);
 await student.screenshot({path:'artifacts/screenshots/08-student-battle-with-quiz.png',fullPage:true});
 const attempt=await student.evaluate(()=>window.__classClash?.snapshot?.self?.quiz?.attemptId);
 await student.reload();
 await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.quiz?.attemptId)).toBe(attempt);
 await student.getByRole('button',{name:/퀴즈 이어 풀기/}).click();
 await expect(student.locator('.quiz-choice')).toHaveCount(4);
 await student.setViewportSize({width:390,height:844});
 await student.screenshot({path:'artifacts/screenshots/09-student-mobile-quiz.png',fullPage:true});
 expect(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
 }catch(error){console.error('UI smoke failed:',error);await student.screenshot({path:'artifacts/screenshots/ui-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await hostContext.close();await studentContext.close();}
});

declare global {interface Window {__classClash:any}}

