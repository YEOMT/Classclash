import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,cpus} from 'node:os';
const out='artifacts/v02/art',base='http://127.0.0.1:3212';await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3212',NODE_ENV:'test',CLASH_TEST_SPEED:'1',DATABASE_PATH:join(tmpdir(),`classclash-v02-art-${Date.now()}.sqlite`)},stdio:['ignore','pipe','pipe']});
let logs='',browser,host,student;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const report={date:'2026-10-28 Asia/Seoul',mode:'actual HTTP/WebSocket game, 1x scheduler; separate original/pipeline gallery',environment:{cpu:cpus()[0]?.model,node:process.version,requestedGPU:'D3D11'},errors:[],status:'RUNNING'};
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 report.health=await(await fetch(base+'/api/health')).json();
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']});report.environment.browser=browser.version();
 const hc=await browser.newContext({viewport:{width:1440,height:1000}}),sc=await browser.newContext({viewport:{width:1280,height:900}});
 host=await hc.newPage();student=await sc.newPage();for(const p of[host,student])p.on('pageerror',e=>report.errors.push(e.stack??e.message));
 await host.goto(base+'/native-art-review.html');await expect(host.locator('article')).toHaveCount(18);await expect(host.locator('#status')).toContainText('18/18');await host.locator('#pause').click();await host.screenshot({path:out+'/01-all-native-champions.png',fullPage:true});
 const original=JSON.parse(await fs.readFile('public/assets/champions/manifest.json','utf8')),contract=JSON.parse(await fs.readFile('public/assets/v2/manifest.json','utf8'));
 await host.goto(base+'/api/health');await host.setContent('<style>body{background:#18252e;color:#e5ebea;font:16px system-ui;margin:24px}article{background:#23343f;padding:15px;border-radius:8px;text-align:center}canvas{image-rendering:pixelated;background:#1b2b35}h2{font-size:18px}</style>');
 await host.evaluate(async({original,contract,base})=>{document.body.innerHTML='<h1>원본 보존 비교 · LOL 리워크</h1><p>위: 70987cb 원본 프레임 / 아래: 0.2 데이터 계약. PNG 픽셀은 변경하지 않았습니다.</p><div id="comparison" style="display:grid;grid-template-columns:repeat(4,1fr);gap:24px"></div>';for(const id of['paladin','brawler','archer','pyromancer']){const old=original[id],next=contract.heroes[id],clip=next.actions.attack.clip,index=next.actions.attack.releaseFrame,article=document.createElement('article');article.innerHTML='<h2>'+next.name+' · '+id+'</h2>';for(const[s,label]of[[old,'원본'],[next,'0.2 계약']]){const r=s.anims[clip].frames[index].data,img=new Image();img.src=base+s.sheet;await img.decode();const c=document.createElement('canvas');c.width=256;c.height=256;c.style.width='256px';c.style.height='256px';const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,r.x,r.y,r.w,r.h,128-r.w,232-r.h*1.84,r.w*2,r.h*2);const title=document.createElement('p');title.textContent=label;article.append(title,c);}document.querySelector('#comparison').append(article);}}, {original,contract,base});
 await host.screenshot({path:out+'/02-source-pipeline-comparison.png',fullPage:true});
 await host.goto(base);await host.getByRole('button',{name:'새 방 만들기'}).click();const code=await host.locator('.topbar .room-code').innerText();
 await student.goto(`${base}/?room=${code}`);await student.getByLabel('닉네임').fill('도트 검증 학생');await student.getByRole('button',{name:'전장에 참가하기'}).click();
 await host.getByRole('button',{name:'30명 채우기'}).click();await expect(host.locator('.player-row')).toHaveCount(30);await host.getByRole('button',{name:'시작 퀴즈 시작'}).click();
 for(let i=0;i<20;i++){await student.locator('.quiz-choice').first().click();await student.getByRole('button',{name:'답안 확정',exact:true}).click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.stats.answered)).toBe(i+1);if(i<19)await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
 await student.locator('[data-action=starter][data-id=paladin]').click({timeout:100000});await student.locator('[data-lane=TOP]').click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.selectedLane)).toBe('TOP');
 const level=student.locator('[data-action=level-up]');if(await level.isEnabled())await level.click();
 await student.getByRole('button',{name:'준비 완료',exact:true}).click();await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:100000});await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
 await expect.poll(()=>host.evaluate(()=>window.__classClash.snapshot.phase),{timeout:20000}).toBe('BATTLE');
 await expect.poll(()=>host.evaluate(()=>window.__classClash.rendererMetrics?.frames??0),{timeout:30000}).toBeGreaterThan(30);
 await expect.poll(()=>host.evaluate(()=>window.__classClash.snapshot.battle.eventSeq),{timeout:100000}).toBeGreaterThan(100);
 report.start=await host.evaluate(()=>({tick:window.__classClash.snapshot.tick,phase:window.__classClash.snapshot.phase,players:window.__classClash.snapshot.players.length,metrics:window.__classClash.rendererMetrics,testSpeed:window.__classClash.snapshot.testSpeed??1}));
 for(const name of['host','student']){
  const current=name==='host'?host:student,state=await current.context().storageState(),session=await current.evaluate(()=>Object.fromEntries(Object.entries(sessionStorage)));
  const recording=await browser.newContext({viewport:{width:name==='host'?1440:1280,height:900},storageState:state,recordVideo:{dir:join(tmpdir(),'classclash-v02-video-'+Date.now()),size:{width:1280,height:800}}});
  await recording.addInitScript(data=>{for(const[k,v]of Object.entries(data))sessionStorage.setItem(k,v);},session);
  const page=await recording.newPage();page.on('pageerror',e=>report.errors.push(e.stack??e.message));await current.context().close();
  if(name==='host')host=page;else student=page;
  await page.goto(base);await expect.poll(()=>page.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:30000}).toBe('BATTLE');
  await expect.poll(()=>page.evaluate(()=>window.__classClash?.rendererMetrics?.frames??0),{timeout:30000}).toBeGreaterThan(20);
  if(name==='student'&&await page.locator('[data-action=deploy]').count()){
   await page.screenshot({path:out+'/03-student-maintenance.png',fullPage:true});
   await expect(page.locator('[data-action=deploy]')).toBeEnabled({timeout:30000});
   await page.locator('[data-action=deploy]').click();
   await expect.poll(()=>page.evaluate(()=>window.__classClash.snapshot.players.find(p=>p.playerId===window.__classClash.snapshot.self.playerId)?.state),{timeout:15000}).toBe('ACTIVE');
  }
  await page.screenshot({path:out+'/03-'+name+'-actual-combat.png',fullPage:true});await page.waitForTimeout(30000);
  report[name+'Capture']=await page.evaluate(()=>({tick:window.__classClash.snapshot.tick,phase:window.__classClash.snapshot.phase,metrics:window.__classClash.rendererMetrics,testSpeed:window.__classClash.snapshot.testSpeed??1}));
  const video=page.video();await recording.close();await video.saveAs(out+'/'+name+'-actual-combat-1x.webm');
 }
 report.end=report.studentCapture;
 expect(report.start.testSpeed).toBe(1);expect(report.end.metrics.assetErrors).toEqual([]);expect(report.errors).toEqual([]);report.status='PASS';report.note='Visual capture only. Concurrent validation/recording load means this is not a performance benchmark or full-match proof.';

}catch(e){report.status='FAIL';report.failure=String(e);process.exitCode=1;console.error(e);if(student){await student.screenshot({path:out+'/failure-student.png',fullPage:true}).catch(()=>{});report.studentFailure=await student.evaluate(()=>({phase:window.__classClash?.snapshot?.phase,self:window.__classClash?.snapshot?.self})).catch(()=>null);}if(host){await host.screenshot({path:out+'/failure-host.png',fullPage:true}).catch(()=>{});report.hostFailure=await host.evaluate(()=>({phase:window.__classClash?.snapshot?.phase,players:window.__classClash?.snapshot?.players})).catch(()=>null);}}
finally{await browser?.close();server.kill();await fs.writeFile(out+'/capture-report.json',JSON.stringify(report,null,2));await fs.writeFile(out+'/server.log',logs);console.log(JSON.stringify({status:report.status,failure:report.failure,errors:report.errors}));}
