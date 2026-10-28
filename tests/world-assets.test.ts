import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createCombat,stepCombat} from '../src/server/combat.js';
import {minionPose} from '../src/client/world-art.js';
import catalog from '../assets/source/world-assets/runtime.json';
import provenance from '../assets/source/world-assets/provenance.json';
import {BATTLE_MAP} from '../src/shared/battle-map.js';
import {minimapTransform} from '../src/client/minimap.js';

test('student minimap includes both bases and uses one scale for world geometry',()=>{
 const t=minimapTransform(384,192);
 for(const s of BATTLE_MAP.structures){const x=t.x+s.x*t.scale,y=t.y+s.y*t.scale;assert.ok(x>=5&&x<=379);assert.ok(y>=5&&y<=187);}
 assert.equal(t.scale,.15);assert.equal(t.x,96);assert.equal(t.y,0);
});

test('raster world matches runtime geometry and every source has a reproducible checksum',()=>{
 const map=fs.readFileSync('public'+BATTLE_MAP.artwork);assert.equal(map.readUInt32BE(16),BATTLE_MAP.width);assert.equal(map.readUInt32BE(20),BATTLE_MAP.height);
 for(const source of provenance.sources){
  const png=fs.readFileSync(`assets/source/world-assets/originals/${source.file}`);
  assert.equal(createHash('sha256').update(png).digest('hex'),source.sha256);
 }
 assert.equal(Object.keys(catalog.minions).length,4);assert.equal(Object.keys(catalog.structures).length,8);
 const png=fs.readFileSync('public/assets/world/effects.png');
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 for(const clip of Object.values(catalog.effects))for(const f of clip.frames){
  assert.ok(f.x>=0&&f.y>=0&&f.x+f.w<=width&&f.y+f.h<=height);assert.ok(f.durationMs>0);
 }
});

test('real melee and ranged windups hold their source poses until the server release tick',()=>{
 for(const kind of ['MELEE_MINION','RANGED_MINION'] as const){
  const s=createCombat(kind,91),a=s.units.find(u=>u.kind===kind&&u.team==='A')!,b=s.units.find(u=>u.kind==='MELEE_MINION'&&u.team==='B')!;
  s.units=[a,b];s.structures=[];s.nextWaveTick=1e9;
  Object.assign(a,{x:1000,y:224,previousX:1000,previousY:224,createdTick:-10,nextAiTick:0,state:'HOLD'});
  Object.assign(b,{x:1030,y:224,previousX:1030,previousY:224,createdTick:-10,speed:0,nextAiTick:1e9,state:'HOLD',nextBasicReadyTick:1e9});
  for(let i=0;i<10&&!a.action;i++)stepCombat(s);
  assert.ok(a.action);const impact=a.action.impactTicks[0]!;
  const spec=catalog.minions[kind==='MELEE_MINION'?'A:melee':'A:ranged'];
  assert.ok(spec.clips.attack.frames.slice(0,2).includes(minionPose(a,impact-.1)));
  assert.equal(minionPose(a,impact),spec.clips.attack.frames[2]);
  const copy=structuredClone(a);copy.action!.cancelled=true;copy.vx=0;copy.vy=0;
  assert.ok(spec.clips.idle.frames.includes(minionPose(copy,impact)));
  a.state='DEAD';a.deathTick=impact;
  assert.equal(minionPose(a,impact+999),spec.clips.death.frames.at(-1));
 }
});
