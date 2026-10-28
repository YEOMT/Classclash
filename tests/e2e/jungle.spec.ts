import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

test('LOL map: one human jungler + 29 ordinary AI, native art, quiz, reconnect, manual redeployment and nexus finish',async({browser,baseURL})=>{
 await mkdir('artifacts/jungle-rework',{recursive:true});
 const hc=await browser.newContext({viewport:{width:1440,height:1100}}),sc=await browser.newContext({viewport:{width:1280,height:900}}),host=await hc.newPage(),student=await sc.newPage(),errors:string[]=[];
 for(const page of [host,student])page.on('pageerror',error=>errors.push(error.message));
 try{
 await host.goto(baseURL!);await host.getByRole('button',{name:'새 방 만들기'}).click();const code=await host.locator('.topbar .room-code').innerText();
 await student.goto(`${baseURL}/?room=${code}`);await student.getByLabel('닉네임').fill('정글 검증 학생');await student.getByRole('button',{name:'전장에 참가하기'}).click();
 await host.getByRole('button',{name:'30명 채우기'}).click();await expect(host.locator('.player-row')).toHaveCount(30);
 await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
 for(let i=0;i<20;i++){await student.locator('.quiz-choice').first().click();await student.getByRole('button',{name:'답안 확정',exact:true}).click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.stats.answered)).toBe(i+1);if(i<19)await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
 await student.locator('[data-action=starter][data-id=paladin]').click();
 await expect(student.locator('[data-action=select-lane]')).toHaveCount(4);await student.locator('[data-lane=JUNGLE]').click();
 await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.selectedLane)).toBe('JUNGLE');
 await student.screenshot({path:'artifacts/jungle-rework/01-positions.png',fullPage:true});await student.getByRole('button',{name:'준비 완료',exact:true}).click();
 await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:70000});await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
 await expect.poll(()=>host.evaluate(()=>window.__classClash.snapshot.phase)).toBe('BATTLE');
 await expect.poll(()=>host.evaluate(()=>window.__classClash.rendererMetrics?.frames??0)).toBeGreaterThan(30);
 await expect.poll(()=>host.evaluate(()=>window.__classClash.snapshot.battle.camps.some((c:any)=>c.respawnTick>window.__classClash.snapshot.battle.battleStartTick)),{timeout:90000}).toBe(true);
 await expect.poll(()=>host.evaluate(()=>(window.__classClash.snapshot.tick-window.__classClash.snapshot.battleStartTick)/20),{timeout:90000}).toBeGreaterThan(60);
 await host.screenshot({path:'artifacts/jungle-rework/02-host-full-map.png',fullPage:true});await student.screenshot({path:'artifacts/jungle-rework/03-jungler-camera.png',fullPage:true});
 const early=await host.evaluate(()=>({tick:window.__classClash.snapshot.tick,positions:window.__classClash.snapshot.players.map((p:any)=>p.lane),camps:window.__classClash.snapshot.battle.camps,heroes:window.__classClash.snapshot.battle.units.filter((u:any)=>u.kind==='HERO').map((u:any)=>({hero:u.heroDefinitionId,position:u.position,jungle:u.jungle})),metrics:window.__classClash.rendererMetrics}));
 expect(early.metrics.assetErrors).toEqual([]);expect(early.positions.includes('MID')).toBe(true);
 const playerId=await student.evaluate(()=>window.__classClash.snapshot.self.playerId);await student.reload();await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBe(playerId);
 await student.getByRole('button',{name:/퀴즈 풀기 · 한 묶음 10문제/}).click();for(let i=0;i<10;i++){await student.locator('.quiz-choice').first().click();await student.getByRole('button',{name:'답안 확정',exact:true}).click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.stats.answered)).toBe(21+i);if(i<9)await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
 await student.locator('[data-action=close-quiz]').click();
 let redeployed=false;const end=Date.now()+1000000;
 while(await host.evaluate(()=>window.__classClash.snapshot.phase)==='BATTLE'&&Date.now()<end){
  const s=await student.evaluate(()=>window.__classClash.snapshot);const p=s.players.find((p:any)=>p.playerId===playerId);
  if(!redeployed&&p.state==='DEAD_MAINTENANCE'&&s.tick>=s.self.redeployNotBeforeTick){await student.locator('[data-lane=MID]').click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.selectedLane)).toBe('MID');await student.waitForTimeout(300);await student.locator('[data-action=deploy]').click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.stats.deployments)).toBe(2);redeployed=true;}
  await writeFile('artifacts/jungle-rework/browser-progress.json',JSON.stringify({phase:s.phase,seconds:(s.tick-s.battleStartTick)/20,redeployed,camps:s.battle.camps,structures:s.battle.structures.map((u:any)=>({id:u.entityId,hp:u.hp})),errors}));
  await host.waitForTimeout(1000);
 }
 await expect.poll(()=>host.evaluate(()=>window.__classClash.snapshot.phase)).toBe('RESULT');await host.waitForTimeout(8000);
 const final=await host.evaluate(()=>window.__classClash.snapshot);expect(final.result.cancelled).toBe(false);expect(final.result.players).toHaveLength(30);expect(final.result.awards).toHaveLength(7);expect(final.battle.structures.some((s:any)=>s.kind==='NEXUS'&&s.hp<=0)).toBe(true);expect(redeployed).toBe(true);expect(final.result.players.find((p:any)=>p.playerId===playerId).stats.deployments).toBe(2);
 await expect(host.locator('.award-card')).toHaveCount(7);await host.screenshot({path:'artifacts/jungle-rework/04-awards.png',fullPage:true});expect(errors).toEqual([]);
 await writeFile('artifacts/jungle-rework/browser-result.json',JSON.stringify({status:'PASS',mode:'real browser, server test scheduler x4',early,redeployed,result:final.result,errors},null,2));
 }finally{await hc.close();await sc.close();}
});
