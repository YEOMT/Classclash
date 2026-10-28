import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const out='artifacts/world-assets',base='http://127.0.0.1:3130';
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3130',DATABASE_PATH:join(tmpdir(),`clash-world-qa-${Date.now()}.sqlite`)},stdio:'ignore'});
const report={errors:[]};let browser;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const stats=a=>{const s=[...a].sort((a,b)=>a-b);return {samples:s.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1)};};
try{
 for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await wait(200);}
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'/battle-art-lab.html');await expect.poll(()=>page.evaluate(()=>window.__artLab?.ready),{timeout:30000}).toBe(true);
 await wait(5500);await page.screenshot({path:out+'/lab-student.png'});
 await page.locator('#host').click();await expect.poll(()=>page.evaluate(()=>window.__artLab.ready)).toBe(true);
 await page.locator('#scene').selectOption('stress');await wait(5000);await page.screenshot({path:out+'/lab-host.png'});
 await wait(25000);
 const q=await page.evaluate(()=>({metrics:window.__artLab.metrics,render:window.__artLab.rendererMetrics,invalid:window.__artLab.state.metrics.invalidPositions,actions:window.__artLab.actions,types:window.__artLab.observed}));
 report.stress={frameMs:stats(q.render.frameMs),sceneCpuMs:stats(q.render.sceneUpdateCpuMs),submitCpuMs:stats(q.render.renderSubmissionCpuMs),simulationMs:stats(q.metrics.simulationMs),peakHeroes:q.metrics.peakHeroes,peakMinions:q.metrics.peakMinions,invalid:q.invalid,worldArt:q.render.worldArt,assetErrors:q.render.assetErrors,actions:q.actions};
 expect(q.invalid).toBe(0);expect(q.render.assetErrors).toEqual([]);expect(q.render.worldArt.effectFrames).toBeGreaterThan(0);expect(q.render.worldArt.peakEffects).toBeLessThanOrEqual(192);
 // Exercise renderer disposal and reload; shared PNG sources must remain alive.
 for(let i=0;i<3;i++){await page.locator(i%2?'#host':'#student').click();await expect.poll(()=>page.evaluate(()=>window.__artLab.ready)).toBe(true);await wait(250);}
 expect(report.errors).toEqual([]);report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error);process.exitCode=1;console.error(error);}
finally{await browser?.close();server.kill();await writeFile(out+'/render-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
