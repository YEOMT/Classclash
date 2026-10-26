import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

// Environment diagnosis only: this empty-canvas probe is never a game FPS result.
const results=[];
for(const mode of ['default-headless','d3d11-headless']){
 let browser;
 try{
  const forced=mode==='d3d11-headless';
  browser=await chromium.launch({timeout:20000,...(forced?{ignoreDefaultArgs:['--enable-unsafe-swiftshader'],args:['--use-gl=angle','--use-angle=d3d11']}:{} )});
  const cdp=await browser.newBrowserCDPSession();const launch=await cdp.send('Browser.getBrowserCommandLine').catch(error=>({arguments:[],unavailable:String(error.message)}));
  const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
  await page.setContent('<canvas width="1366" height="768"></canvas>');
  const sample=await page.evaluate(()=>new Promise(resolve=>{
   const gl=document.querySelector('canvas').getContext('webgl2');if(!gl){resolve({status:'UNAVAILABLE',reason:'WebGL2 context unavailable'});return;}
   const ext=gl.getExtension('WEBGL_debug_renderer_info'),values=[];const start=performance.now();let previous=start;
   function frame(now){values.push(now-previous);previous=now;gl.clearColor(.12,.2,.16,1);gl.clear(gl.COLOR_BUFFER_BIT);if(now-start<10000){requestAnimationFrame(frame);return;}values.sort((a,b)=>a-b);resolve({status:'MEASURED',frames:values.length,p50:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):'unavailable'});}requestAnimationFrame(frame);
  }));
  results.push({mode,browser:browser.version(),requestedFlags:forced?['--use-gl=angle','--use-angle=d3d11']:[],launchFlags:launch.arguments.filter(arg=>/headless|angle|swiftshader|gpu/.test(arg)),launchFlagsUnavailable:launch.unavailable,...sample});
 }catch(error){results.push({mode,status:'UNAVAILABLE',reason:String(error.message).split('Call log:')[0].trim()});}
 finally{await browser?.close();}
}
await writeFile('artifacts/gpu-environment-probe.json',JSON.stringify({measuredAt:new Date().toISOString(),scope:'Empty WebGL2 canvas, 10 seconds each. Renderer identity and browser scheduling only; not gameplay, P03, or school-device evidence.',results},null,2));
console.log(JSON.stringify(results,null,2));
