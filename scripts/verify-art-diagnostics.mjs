import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:3213',out='artifacts/v02/art';
await fs.mkdir(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3213','--strictPort'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
let browser,logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const report={status:'RUNNING',mode:'Vite development build of current source, isolated actual combat-engine art fixture',expectedErrors:[],unexpectedErrors:[],checks:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,150));}
 browser=await chromium.launch({args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});let injecting=true;
 page.on('pageerror',error=>(injecting?report.expectedErrors:report.unexpectedErrors).push(error.message));
 await page.route('**/assets/champions/paladin.png',route=>route.abort('failed'));
 await page.goto(base+'/battle-art-lab.html');
 await expect(page.getByRole('alert')).toContainText('필수 그래픽을 불러오지 못했습니다',{timeout:60000});
 await expect(page.getByRole('button',{name:'다시 불러오기',exact:true})).toBeVisible();
 await expect(page.locator('#stage canvas')).toBeHidden();
 await page.screenshot({path:out+'/05-missing-asset-recovery.png',fullPage:true});
 report.checks.push({id:'ART-12',status:'PASS',assertions:['Required native PNG aborted','Visible actionable error','No invisible hero canvas continues']});
 await page.unroute('**/assets/champions/paladin.png');injecting=false;await page.reload();
 await expect.poll(()=>page.evaluate(()=>window.__artLab?.ready??false),{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>window.__artLab?.rendererMetrics.frames??0),{timeout:20000}).toBeGreaterThan(20);
 for(let i=0;i<4;i++){await page.locator(i%2?'#student':'#host').click();await expect.poll(()=>page.evaluate(()=>window.__artLab?.ready??false),{timeout:30000}).toBe(true);await expect.poll(()=>page.evaluate(()=>window.__artLab?.rendererMetrics.frames??0),{timeout:20000}).toBeGreaterThan(5);}
 await page.screenshot({path:out+'/05-native-art-lab-recovered.png',fullPage:true});
 report.recovered=await page.evaluate(()=>({ready:window.__artLab.ready,tick:window.__artLab.state.tick,assetErrors:window.__artLab.rendererMetrics.assetErrors,frames:window.__artLab.rendererMetrics.frames,observed:window.__artLab.observed}));
 expect(report.recovered.assetErrors).toEqual([]);expect(report.unexpectedErrors).toEqual([]);
 report.checks.push({id:'renderer-shared-textures',status:'PASS',assertions:['Reload recovered original PNG','Four host/student renderer replacements render successfully without shared atlas destruction']});report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error);process.exitCode=1;}finally{await browser?.close();server.kill();await fs.writeFile(out+'/asset-diagnostics.json',JSON.stringify(report,null,2)+'\n');await fs.writeFile(out+'/asset-diagnostics-server.log',logs);console.log(JSON.stringify(report));}
