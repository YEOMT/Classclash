import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,cpus,release} from 'node:os';
import {DEFAULT_BANK} from '../src/server/quiz.ts';

const base='http://127.0.0.1:3124',out='artifacts/asset-motion';await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3124',DATABASE_PATH:join(tmpdir(),`classclash-motion-${Date.now()}.sqlite`),CLASH_TEST_SPEED:'1'},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const report={measuredAt:new Date().toISOString(),environment:{cpu:cpus()[0]?.model,os:release(),node:process.version,viewport:'1440x1000',speed:'normal 1x'},errors:[]};
let browser,hc,sc,lc,host,student,lab;
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return{samples:s.length,p50:s[Math.floor(s.length*.5)]??0,p95:s[Math.floor(s.length*.95)]??0,p99:s[Math.floor(s.length*.99)]??0,max:s.at(-1)??0};};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(p){await expect.poll(()=>p.evaluate(()=>window.__artLab?.ready),{timeout:30000}).toBe(true);}
async function metrics(p){return p.evaluate(()=>{const s=window.__classClash?.snapshot,m=window.__classClash?.rendererMetrics;return{s:{phase:s.phase,tick:s.tick,diagnostics:s.diagnostics,battle:{tick:s.battle.tick,invalidPositions:s.battle.metrics.invalidPositions}},m,q:window.__motionQA};});}
async function monitor(p){await p.evaluate(()=>{const q=window.__motionQA={frames:[],counts:[],skills:[],types:[],heroIds:[],lastSeq:0,lastFrame:performance.now(),running:true};let lastCount=0;
 function f(now){if(!q.running)return;q.frames.push(now-q.lastFrame);q.lastFrame=now;const b=window.__classClash.snapshot?.battle;
  if(b&&now-lastCount>150){lastCount=now;q.counts.push({heroes:b.units.filter(u=>u.kind==='HERO'&&u.hp>0).length,minions:b.units.filter(u=>u.kind.endsWith('MINION')&&u.hp>0).length});for(const u of b.units)if(u.heroDefinitionId&&!q.heroIds.includes(u.heroDefinitionId))q.heroIds.push(u.heroDefinitionId);
   for(const e of b.events){if(e.eventSeq<=q.lastSeq)continue;q.lastSeq=e.eventSeq;if(!q.types.includes(e.type))q.types.push(e.type);if(e.type==='SKILL_CAST'){const skill=e.params.skillId??e.effectId;if(!q.skills.includes(skill))q.skills.push(skill);}}
  }requestAnimationFrame(f);
 }requestAnimationFrame(f);
 });}
function summarized(data){return{frameMs:summary(data.q.frames),sceneUpdateMs:summary(data.m.sceneUpdateCpuMs),renderSubmissionMs:summary(data.m.renderSubmissionCpuMs),peakHeroes:Math.max(...data.q.counts.map(c=>c.heroes)),peakMinions:Math.max(...data.q.counts.map(c=>c.minions)),heroIds:data.q.heroIds,skills:data.q.skills,events:data.q.types,assetErrors:data.m.assetErrors,invalidPositions:data.s.battle.invalidPositions,diagnostics:data.s.diagnostics};}
async function trim(source,start,dest,duration=55){
 const ff='C:/Users/jarsc/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';
 await new Promise((resolve,reject)=>{const p=spawn(ff,['-y','-ss',String(Math.max(0,start)),'-i',source,'-t',String(duration),'-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8','-b:v','1800k',dest],{windowsHide:true,stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('exit',code=>code===0?resolve():reject(new Error(err)));});
}
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await wait(200);}
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']});report.environment.browser=browser.version();
 const recording=()=>({viewport:{width:1440,height:1000},deviceScaleFactor:1,recordVideo:{dir:join(tmpdir(),`classclash-motion-${Date.now()}`),size:{width:1440,height:1000}}});
 hc=await browser.newContext(recording());sc=await browser.newContext(recording());host=await hc.newPage();const hostStart=Date.now();student=await sc.newPage();const studentStart=Date.now();
 for(const p of [host,student]){p.setDefaultTimeout(20000);p.on('pageerror',e=>report.errors.push(e.message));}
 await host.goto(base);await host.getByRole('button',{name:'새 방 만들기'}).click();const room=await host.locator('.topbar .room-code').innerText();
 await student.goto(`${base}/?room=${room}`);await student.getByLabel('닉네임').fill('서윤 궁수');await student.getByRole('button',{name:'전장에 참가하기'}).click();
 await expect.poll(()=>student.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBeTruthy();
 await host.getByRole('button',{name:'30명 채우기',exact:true}).click();await expect(host.locator('.player-row')).toHaveCount(30);
 await host.getByRole('button',{name:/^시작 퀴즈 시작/}).click();
 for(let i=0;i<20;i++){
  await expect(student.locator('.quiz-choice').first()).toBeVisible();
  const q=await student.evaluate(()=>window.__classClash.snapshot.self.quiz.question),answer=DEFAULT_BANK.find(v=>v.text===q.text).answers[0],option=q.options.find(v=>v.text===answer);
  await student.locator(`[data-action=choose-answer][data-id="${option.id}"]`).click();await student.getByRole('button',{name:'답안 확정',exact:true}).click();
  if(i<19)await student.getByRole('button',{name:'다음 문제 →',exact:true}).click();
 }
 if(await host.getByRole('button',{name:'시작 퀴즈 마감',exact:true}).count()){await host.getByRole('button',{name:'시작 퀴즈 마감',exact:true}).click();await host.locator('[data-modal-confirm]').click();}
 await student.locator('[data-action=starter][data-id=archer]').click();
 for(let level=2;level<=5;level++){await student.locator('[data-action=level-up]').click();await expect.poll(()=>student.evaluate(()=>window.__classClash.snapshot.self.inventory[0].level)).toBe(level);}
 await student.getByRole('button',{name:'준비 완료',exact:true}).click();
 await expect(host.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:45000});await host.getByRole('button',{name:'전투 시작 →',exact:true}).click();
 await expect.poll(()=>host.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:20000}).toBe('BATTLE');
 await expect.poll(()=>student.evaluate(()=>window.__classClash?.rendererMetrics?.frames??0),{timeout:30000}).toBeGreaterThan(10);
 await monitor(host);await monitor(student);console.log('Actual HTTP/WS battle recording: 1 human archer + 29 AI, level 5 earned through 20 quiz answers.');
 await expect.poll(()=>host.evaluate(()=>window.__classClash.snapshot.battle.metrics.firstHitTick),{timeout:50000}).not.toBeNull();const contactAt=Date.now();
 for(let i=0;i<11;i++){
  await wait(5000);
  if(i===2||i===7){await host.screenshot({path:`${out}/real-host-${i}.png`});await student.screenshot({path:`${out}/real-student-${i}.png`});}
  const deploy=student.locator('[data-action=deploy]');if(await deploy.count()&&await deploy.isEnabled())await deploy.click();
  if(i%4===0)console.log(`Real combat contact +${(i+1)*5}s`);
 }
 report.realRoom={fixture:'Actual production HTTP/WebSocket room; 1 human student + 29 STANDARD AI; 20 ordinary correct answers paid normal level-up costs; no test speed or state injection',host:summarized(await metrics(host)),student:summarized(await metrics(student))};
 const canvas=host.locator('#battle-canvas canvas');report.environment.gpu=await canvas.evaluate(c=>{const g=c.getContext('webgl2')??c.getContext('webgl'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable';});
 await host.getByRole('button',{name:'경기 중단',exact:true}).click();await host.locator('[data-modal-confirm]').click();
 const hv=host.video(),sv=student.video();await hc.close();hc=null;await sc.close();sc=null;
 await trim(await hv.path(),(contactAt-hostStart)/1000-8,`${out}/host-real-combat.webm`);
 await trim(await sv.path(),(contactAt-studentStart)/1000-8,`${out}/student-real-combat.webm`);
 console.log('Real-room videos saved; recording the three-hero skill/death fixture.');
 lc=await browser.newContext(recording());lab=await lc.newPage();lab.on('pageerror',e=>report.errors.push(e.message));await lab.goto(base+'/battle-art-lab.html');await ready(lab);
 await expect.poll(()=>lab.evaluate(()=>window.__artLab.actions.length),{timeout:20000}).toBe(6);
 await lab.screenshot({path:out+'/skill-combat-student.png'});
 await expect.poll(()=>lab.evaluate(()=>window.__artLab.observed.includes('DEATH')),{timeout:30000}).toBe(true);
 report.skillFixture=await lab.evaluate(()=>({skills:window.__artLab.actions,events:window.__artLab.observed,assetErrors:window.__artLab.rendererMetrics.assetErrors,invalidPositions:window.__artLab.state.metrics.invalidPositions}));
 await lab.getByRole('button',{name:'호스트 전체맵',exact:true}).click();await ready(lab);await lab.screenshot({path:out+'/skill-combat-host.png'});await wait(3000);
 const lv=lab.video();await lc.close();lc=null;await copyFile(await lv.path(),out+'/skills-and-death.webm');
 // Separate stress measurement with recording disabled avoids conflating encoder work.
 lc=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});lab=await lc.newPage();lab.on('pageerror',e=>report.errors.push(e.message));await lab.goto(base+'/battle-art-lab.html');await ready(lab);
 await lab.locator('#scene').selectOption('stress');await lab.getByRole('button',{name:'호스트 전체맵',exact:true}).click();await ready(lab);await lab.screenshot({path:out+'/stress-all-18.png'});
 report.stress=await lab.evaluate(()=>new Promise(resolve=>{const frames=[],ids=new Set(window.__artLab.state.units.map(u=>u.heroDefinitionId).filter(Boolean));const start=performance.now();let last=start;function frame(now){frames.push(now-last);last=now;if(now-start<30000){requestAnimationFrame(frame);return;}resolve({frames,ids:[...ids],heroes:window.__artLab.metrics.peakHeroes,minions:window.__artLab.metrics.peakMinions,metrics:window.__artLab.rendererMetrics,invalidPositions:window.__artLab.state.metrics.invalidPositions,skills:window.__artLab.actions});}requestAnimationFrame(frame);}));
 report.stress.frameMs=summary(report.stress.frames);delete report.stress.frames;report.stress.sceneUpdateMs=summary(report.stress.metrics.sceneUpdateCpuMs);report.stress.renderSubmissionMs=summary(report.stress.metrics.renderSubmissionCpuMs);report.stress.assetErrors=report.stress.metrics.assetErrors;delete report.stress.metrics;
 for(const v of [report.realRoom.host,report.realRoom.student,report.skillFixture,report.stress]){expect(v.assetErrors).toEqual([]);expect(v.invalidPositions).toBe(0);}expect(report.stress.ids).toHaveLength(18);expect(report.stress.heroes).toBe(30);expect(report.stress.minions).toBe(84);expect(report.errors).toEqual([]);
 report.status='PASS';report.limitations='Local Windows Chromium, D3D11. Actual-room measurements include two simultaneous views and video recording. Stress is a staged client-side fixture using the unchanged production combat engine, with recording disabled. RAF intervals do not guarantee display scanout or tablet performance.';
}catch(e){report.status='FAIL';report.failure=String(e);process.exitCode=1;console.error(e);for(const [id,p] of [['host',host],['student',student],['lab',lab]])if(p&&!p.isClosed())await p.screenshot({path:`${out}/failure-${id}.png`}).catch(()=>{});}
finally{await writeFile(out+'/verification.json',JSON.stringify(report,null,2));await hc?.close();await sc?.close();await lc?.close();await browser?.close();server.kill();console.log(JSON.stringify(report,null,2));}
