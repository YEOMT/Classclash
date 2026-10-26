import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const mode of ['headless-shell','unified-headless']){
 try {
 const browser=await chromium.launch(mode==='unified-headless'?{channel:'chromium'}:{});
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
 await page.setContent('<canvas width="1366" height="768"></canvas><p>Empty canvas scheduling baseline</p>');
 const sample=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let before=performance.now(),start=before;const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl?.getExtension('WEBGL_debug_renderer_info');function frame(now){frames.push(now-before);before=now;if(now-start<15000){requestAnimationFrame(frame);return;}frames.sort((a,b)=>a-b);resolve({frames:frames.length,p50:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)],p99:frames[Math.floor(frames.length*.99)],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'});}requestAnimationFrame(frame);}));
 results.push({mode,browser:browser.version(),...sample});await browser.close();
 } catch(error){results.push({mode,status:'NOT_RUN',reason:String(error.message).split('Call log:')[0].trim()});}
}
await writeFile('artifacts/render-scheduling-baseline.json',JSON.stringify({measuredAt:new Date().toISOString(),fixture:'Empty WebGL canvas; 15 wall-clock seconds each; same viewport and device scale as host performance test. This measures frame scheduling, not game performance.',results},null,2));
console.log(JSON.stringify(results,null,2));
