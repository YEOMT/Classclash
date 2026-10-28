import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const server=spawn(process.execPath,['dist/server.js'],{windowsHide:true,env:{...process.env,PORT:'3128',DATABASE_PATH:join(tmpdir(),`clash-viewer-${Date.now()}.sqlite`)},stdio:'ignore'});let browser;const report={errors:[]};
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:3128/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch();const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:3128/art-gallery.html');await expect(p.locator('#status')).toContainText('648');await expect(p.locator('.hero')).toHaveCount(18);await p.locator('#state').selectOption('skill2');await p.locator('#direction').selectOption('W');await p.locator('#pause').click();await p.locator('#next').click();await p.screenshot({path:'artifacts/asset-motion/gallery-final.png',fullPage:true});
 report.gallery=await p.locator('canvas').evaluateAll(cs=>cs.map(c=>{const a=c.getContext('2d').getImageData(0,0,64,64).data;let count=0;for(let i=3;i<a.length;i+=4)if(a[i])count++;return count;}));expect(report.gallery.every(n=>n>100)).toBe(true);
 await p.goto('http://127.0.0.1:3125/');await expect(p.locator('.grid article')).toHaveCount(18);await expect.poll(()=>p.locator('video').first().evaluate(v=>Number.isFinite(v.duration)),{timeout:15000}).toBe(true);
 report.videos=await p.locator('video').evaluateAll(vs=>vs.map(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message??null})));
 for(const index of [0,1,2]){const video=p.locator('video').nth(index);await video.evaluate(v=>{v.muted=true;return v.play();});await expect.poll(()=>video.evaluate(v=>v.currentTime)).toBeGreaterThan(.25);await video.evaluate(v=>v.pause());}
 await p.screenshot({path:'artifacts/asset-motion/review-final.png',fullPage:true});await p.locator('#state').selectOption('death');await p.locator('#step').click();await p.locator('#mirror').click();expect(report.errors).toEqual([]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e);process.exitCode=1;console.error(e);}finally{await browser?.close();server.kill();await writeFile('artifacts/asset-motion/viewer-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
