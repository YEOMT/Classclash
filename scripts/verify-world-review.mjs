import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch();const report={errors:[],videos:[]};
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:3131/');
 for(let i=0;i<2;i++){
  const v=p.locator('video').nth(i);await v.scrollIntoViewIfNeeded();
  const info=await v.evaluate(async video=>{video.muted=true;await video.play();await new Promise(r=>video.readyState>=2?r():video.addEventListener('loadeddata',r,{once:true}));video.currentTime=3;await new Promise(r=>video.addEventListener('seeked',r,{once:true}));return{width:video.videoWidth,height:video.videoHeight,duration:video.duration};});
  expect(info.duration).toBeGreaterThan(20);expect(info.width).toBeGreaterThan(900);
  await p.waitForTimeout(600);await v.screenshot({path:`artifacts/world-assets/${i?'host':'student'}-video-frame.png`});
  await v.evaluate(video=>video.pause());report.videos.push(info);
 }
 const images=await p.locator('img').evaluateAll(images=>images.map(im=>({src:im.getAttribute('src'),loaded:im.complete&&im.naturalWidth>0})));
 expect(images.every(im=>im.loaded)).toBe(true);expect(report.errors).toEqual([]);report.images=images;report.status='PASS';
 await p.screenshot({path:'artifacts/world-assets/review-page.png',fullPage:true});
}finally{await browser.close();await writeFile('artifacts/world-assets/viewer-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
