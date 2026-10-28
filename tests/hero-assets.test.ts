import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HERO_BY_ID} from '../src/shared/heroes.js';
import {HERO_ANIMATIONS} from '../src/client/hero-animation.js';
import {HERO_ATLAS} from '../src/client/hero-atlas.js';

test('every playable hero ships complete raster animation states and in-bounds frames',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/assets/heroes/manifest.json','utf8'));
 assert.equal(manifest.revision,'asset-motion-01');
 for(const id of Object.keys(HERO_BY_ID)){
  const entry=manifest.heroes[id],meta=JSON.parse(fs.readFileSync(`public${entry.metadata}`,'utf8')),png=fs.readFileSync(`public${entry.image}`);
  assert.equal(png.readUInt32BE(16),HERO_ATLAS.width);assert.equal(png.readUInt32BE(20),HERO_ATLAS.height);
  assert.equal(meta.poses.length,36);assert.ok(meta.uniqueRasterPoses>=15,`${id} has distinct poses`);
  assert.equal(meta.directionMode,'side-mirrored');assert.match(meta.sourceSha256,/^[a-f0-9]{64}$/);
  for(const [state,spec] of Object.entries(HERO_ANIMATIONS)){
   const clip=meta.animations[state];assert.equal(clip.frames.length,spec.count,`${id}/${state}`);
   for(const r of clip.frames)assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=HERO_ATLAS.width&&r.y+r.h<=HERO_ATLAS.height);
  }
 }
});
