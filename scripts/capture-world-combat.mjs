// Film one camera at a time. The other role is only a control page (no renderer).
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DEFAULT_BANK} from '../src/server/quiz.ts';
const base='http://127.0.0.1:3129',out='artifacts/world-assets';
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3129',DATABASE_PATH:join(tmpdir(),`clash-motion-film-${Date.now()}.sqlite`),CLASH_TEST_SPEED:'1'},stdio:'ignore'});
let browser,hc,sc,h,s;const report={mode:'Sequential real-room cameras; one WebGL view and one encoder at a time; normal 1x',errors:[]};const wait=ms=>new Promise(r=>setTimeout(r,ms));
const options=record=>({viewport:{width:1440,height:1000},deviceScaleFactor:1,...(record?{recordVideo:{dir:join(tmpdir(),`clash-film-${Date.now()}`),size:{width:1440,height:1000}}}:{})});
const summary=a=>{const v=[...a].sort((a,b)=>a-b);return{samples:v.length,p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],p99:v[Math.floor(v.length*.99)],max:v.at(-1)};};
async function startSample(p){await p.evaluate(()=>{const q=window.__film={frames:[],ticks:[],startTick:window.__classClash.snapshot.battle.tick,types:[],skills:[],lastSeq:0,last:performance.now()};function f(now){q.frames.push(now-q.last);q.last=now;const b=window.__classClash.snapshot.battle;q.ticks.push(b.tick);for(const e of b.events){if(e.eventSeq<=q.lastSeq)continue;q.lastSeq=e.eventSeq;if(!q.types.includes(e.type))q.types.push(e.type);if(e.type==='SKILL_CAST'&&!q.skills.includes(e.params.skillId))q.skills.push(e.params.skillId);}requestAnimationFrame(f);}requestAnimationFrame(f);});}
async function finishSample(p){const q=await p.evaluate(()=>({...window.__film,assetErrors:window.__classClash.rendererMetrics.assetErrors,server:window.__classClash.snapshot.diagnostics,invalidPositions:window.__classClash.snapshot.battle.metrics.invalidPositions}));return{frameMs:summary(q.frames),simulationTicks:q.ticks.at(-1)-q.startTick,events:q.types,skills:q.skills,assetErrors:q.assetErrors,invalidPositions:q.invalidPositions,server:q.server};}
async function encode(src,start,dest){const ff='C:/Users/jarsc/AppData/Local/ms-playwright/ffmpeg-1013/ffmpeg-win64.exe';await new Promise((resolve,reject)=>{const p=spawn(ff,['-y','-ss',String(Math.max(0,start)),'-i',src,'-t','35','-an','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','8','-b:v','1600k',dest],{windowsHide:true,stdio:['ignore','ignore','pipe']});let log='';p.stderr.on('data',d=>log+=d);p.on('exit',c=>c===0?resolve():reject(new Error(log)));});}
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await wait(200);}
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']});
 hc=await browser.newContext(options(false));sc=await browser.newContext(options(false));h=await hc.newPage();s=await sc.newPage();
 for(const p of [h,s]){p.setDefaultTimeout(20000);p.on('pageerror',e=>report.errors.push(e.message));}
 await h.goto(base+'/?diagnosticRender=0');await h.getByRole('button',{name:'새 방 만들기'}).click();const code=await h.locator('.topbar .room-code').innerText();
 await s.goto(base+'/?room='+code);await s.getByLabel('닉네임').fill('서윤 궁수');await s.getByRole('button',{name:'전장에 참가하기'}).click();await expect.poll(()=>s.evaluate(()=>window.__classClash?.snapshot?.self?.playerId)).toBeTruthy();
 await h.getByRole('button',{name:'30명 채우기',exact:true}).click();await h.getByRole('button',{name:/^시작 퀴즈 시작/}).click();
 for(let i=0;i<20;i++){await expect(s.locator('.quiz-choice').first()).toBeVisible();const q=await s.evaluate(()=>window.__classClash.snapshot.self.quiz.question),answer=DEFAULT_BANK.find(v=>v.text===q.text).answers[0],option=q.options.find(v=>v.text===answer);await s.locator(`[data-action=choose-answer][data-id="${option.id}"]`).click();await s.getByRole('button',{name:'답안 확정',exact:true}).click();if(i<19)await s.getByRole('button',{name:'다음 문제 →',exact:true}).click();}
 await h.getByRole('button',{name:'시작 퀴즈 마감',exact:true}).click();await h.locator('[data-modal-confirm]').click();await s.locator('[data-action=starter][data-id=archer]').click();
 for(let level=2;level<=5;level++){await s.locator('[data-action=level-up]').click();await expect.poll(()=>s.evaluate(()=>window.__classClash.snapshot.self.inventory[0].level)).toBe(level);}
 await s.getByRole('button',{name:'준비 완료',exact:true}).click();
 const studentSession=await s.evaluate(()=>sessionStorage.getItem('classclash:active'));await sc.close();sc=await browser.newContext(options(true));await sc.addInitScript(value=>sessionStorage.setItem('classclash:active',value),studentSession);s=await sc.newPage();const ss=Date.now();s.on('pageerror',e=>report.errors.push(e.message));await s.goto(base);
 await expect(h.getByRole('button',{name:'전투 시작 →',exact:true})).toBeEnabled({timeout:30000});await h.getByRole('button',{name:'전투 시작 →',exact:true}).click();await expect.poll(()=>s.evaluate(()=>window.__classClash?.snapshot?.phase),{timeout:20000}).toBe('BATTLE');await expect.poll(()=>s.evaluate(()=>window.__classClash.rendererMetrics?.frames??0),{timeout:30000}).toBeGreaterThan(30);await startSample(s);
 await expect.poll(()=>s.evaluate(()=>window.__classClash.snapshot.battle.metrics.firstHitTick),{timeout:45000}).not.toBeNull();const contact=Date.now();console.log('Filming student only.');
 for(let i=0;i<7;i++){await wait(5000);if(i===2)await s.screenshot({path:out+'/student-final.png'});const deploy=s.locator('[data-action=deploy]');if(await deploy.count()&&await deploy.isEnabled())await deploy.click();}
 report.student=await finishSample(s);const sv=s.video();await sc.close();sc=null;
 const hostSession=await h.evaluate(()=>sessionStorage.getItem('classclash:active'));await hc.close();hc=await browser.newContext(options(true));await hc.addInitScript(value=>sessionStorage.setItem('classclash:active',value),hostSession);h=await hc.newPage();const hs=Date.now();h.on('pageerror',e=>report.errors.push(e.message));await h.goto(base);await expect.poll(()=>h.evaluate(()=>window.__classClash.rendererMetrics?.frames??0),{timeout:30000}).toBeGreaterThan(30);await startSample(h);console.log('Filming host only, same server match.');
 await wait(15000);await h.screenshot({path:out+'/host-final.png'});await wait(20000);report.host=await finishSample(h);
 await h.getByRole('button',{name:'경기 중단',exact:true}).click();await h.locator('[data-modal-confirm]').click();const hv=h.video();await hc.close();hc=null;await browser.close();browser=null;server.kill();
 // Both encodes run AFTER the match, so they cannot slow the server or camera.
 await encode(await sv.path(),(contact-ss)/1000-5,out+'/student-real-combat.webm');await encode(await hv.path(),2,out+'/host-real-combat.webm');
 expect(report.errors).toEqual([]);for(const q of [report.student,report.host]){expect(q.assetErrors).toEqual([]);expect(q.invalidPositions).toBe(0);}report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e);process.exitCode=1;console.error(e);for(const [label,p] of [['student',s],['host',h]])if(p&&!p.isClosed())await p.screenshot({path:out+'/film-failure-'+label+'.png'}).catch(()=>{});}
finally{await writeFile(out+'/sequential-recording.json',JSON.stringify(report,null,2));await hc?.close();await sc?.close();await browser?.close();server.kill();console.log(JSON.stringify({...report,host:report.host?{...report.host,server:undefined}:undefined,student:report.student?{...report.student,server:undefined}:undefined},null,2));}
