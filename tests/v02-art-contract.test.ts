import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CHAMPION_ART,sampleChampion} from '../src/client/champion-animation.js';
import {nativeLoopFrame,stableFacing,socketOffset,type ChampionArt} from '../src/client/art-contract.js';
import {soundProfile} from '../src/client/combat-audio.js';
import {HERO_BY_ID} from '../src/shared/heroes.js';
import type {CombatUnit} from '../src/shared/combat-types.js';

test('v0.2 preserves every approved source and serves the native 18 champions with verified bytes',()=>{
 const lock=JSON.parse(fs.readFileSync('assets/art-source/source-lock.json','utf8'));
 for(const[file,hash]of Object.entries(lock.files))assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,file);
 const manifest=JSON.parse(fs.readFileSync('public/assets/v2/manifest.json','utf8'));
 assert.equal(fs.readFileSync('src/generated/art-manifest.json','utf8'),fs.readFileSync('public/assets/v2/manifest.json','utf8'),'Vite source module and served gallery contract remain identical');
 assert.equal(Object.keys(manifest.heroes).length,18);assert.equal(manifest.assetVersion,'0.2-native-preserved');
 for(const[url,hash]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync('public'+url)).digest('hex'),hash,url);
 assert.equal(manifest.distribution.publicDistributionAuthorized,false);
 const original=JSON.parse(fs.readFileSync('public/assets/champions/manifest.json','utf8'));
 for(const[id,hero]of Object.entries(CHAMPION_ART))for(const[clip,anim]of Object.entries(hero.anims))assert.deepEqual(anim.frames.map(f=>({duration:f.duration,data:f.data})),original[id].anims[clip].frames,`${id}/${clip} retains every native frame and duration`);
});

function hero(id:string){return {heroDefinitionId:id,state:'HOLD',facingX:1,facingY:0,vx:0,vy:0,createdTick:0,action:null} as unknown as CombatUnit;}
test('all 18 native champions bind both skills and basics to their committed release frames',()=>{
 for(const[id,spec]of Object.entries(CHAMPION_ART))for(const[key,skillId]of [['attack',null],['skill1',HERO_BY_ID[id]!.skillIds[0]],['skill2',HERO_BY_ID[id]!.skillIds[1]]] as const){
  const u=hero(id);u.action={startTick:100,impactTicks:[106,109,112],recoveryEndTick:120,skillId} as CombatUnit['action'];
  const binding=spec.actions[key]!;
  assert.equal(sampleChampion(u,106).index,binding.releaseFrame,`${id}/${key}`);
  assert.ok(sampleChampion(u,105.9).index<=Math.max(0,binding.releaseFrame-1));
  assert.ok(sampleChampion(u,120).index<spec.anims[binding.clip]!.frames.length);
  u.action!.cancelled=true;assert.equal(sampleChampion(u,106).clip,spec.clips.idle);
 }
});
test('multi-hit skills select native strike poses at each server hit and not at a free-running FPS',()=>{
 for(const[id,key,skillId]of [['brawler','skill1','brawler.flurry'],['assassin','skill2','assassin.vital_combo'],['rune_mage','skill1','rune_mage.triple_rune'],['ancient_one','skill2','ancient_one.primordial_fissure']] as const){
  const u=hero(id);u.action={startTick:100,impactTicks:[106,109,112],recoveryEndTick:120,skillId} as CombatUnit['action'];
  assert.deepEqual([106,109,112].map(t=>sampleChampion(u,t).index),CHAMPION_ART[id]!.actions[key]!.multiHitFrames);
 }
});
test('variable single-frame clips remain valid through windup, impact, recovery and death',()=>{
 const original=CHAMPION_ART.archer!,spec=structuredClone(original) as ChampionArt,frame=spec.anims.idle!.frames[0]!;
 spec.anims.one={frames:[frame]};spec.clips.attack='one';spec.clips.dead='one';spec.actions.attack={clip:'one',releaseFrame:0,multiHitFrames:[0,0,0]};
 const u=hero('archer');u.action={startTick:100,impactTicks:[106],recoveryEndTick:120,skillId:null} as CombatUnit['action'];
 for(const t of [99,100,105,106,119,120])assert.equal(sampleChampion(u,t,-Infinity,spec).index,0);
 u.state='DEAD';u.deathTick=120;assert.equal(sampleChampion(u,1000,-Infinity,spec).index,0);
 assert.equal(nativeLoopFrame([frame],1e8,true),0);
});
test('native pivots and sockets are frame-local metadata and facing has a vertical deadband',()=>{
 for(const spec of Object.values(CHAMPION_ART))for(const anim of Object.values(spec.anims))for(const frame of anim.frames){
  assert.deepEqual(socketOffset(frame,'feet',false),{x:0,y:0});
  assert.equal(socketOffset(frame,'projectileOrigin',true).x,-socketOffset(frame,'projectileOrigin',false).x);
  assert.ok(frame.pivot[0]>=0&&frame.pivot[0]<=frame.data.w&&frame.pivot[1]>=0&&frame.pivot[1]<=frame.data.h);
 }
 assert.equal(stableFacing(-.01,false),false);assert.equal(stableFacing(.01,true),true);assert.equal(stableFacing(-.3,false),true);assert.equal(stableFacing(.3,true),false);
});
test('sound families distinguish arrows, flame, frost, healing, towers, fists and metal',()=>{
 const cues=['archer.arrow','pyromancer.fire','cryomancer.frost','priest.heal','tower.shot','brawler.flurry','paladin.shield'].map(e=>soundProfile(e,'HIT'));
 assert.equal(new Set(cues.map(c=>c.family)).size,7);for(const cue of cues)assert.ok(cue.seconds>0&&cue.seconds<=.2);
});

test('native attacks preserve release poses at different authoritative attack speeds and ignore cosmetic hurt interruption',()=>{
 for(const id of Object.keys(CHAMPION_ART))for(const scale of [.5,1,2]){
  const u=hero(id),impact=100+12*scale,end=impact+10*scale;
  u.action={startTick:100,impactTicks:[impact],recoveryEndTick:end,skillId:null} as CombatUnit['action'];
  const release=CHAMPION_ART[id]!.actions.attack!;
  const pose=sampleChampion(u,impact,impact);
  assert.equal(pose.clip,release.clip,id);assert.equal(pose.index,release.releaseFrame,id);
  assert.ok(sampleChampion(u,end-.01,impact).index>=release.releaseFrame,id);
 }
 const u=hero('paladin');u.vx=20;u.state='ADVANCE';
 assert.equal(sampleChampion(u,101,100).clip,CHAMPION_ART.paladin!.clips.hit);
 assert.equal(sampleChampion(u,104,100).clip,CHAMPION_ART.paladin!.clips.run);
});
