import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertSourcesUnchanged,sha256} from './pack-art.mjs';
export function validateArt({release=false}={}){
 assertSourcesUnchanged();const manifest=JSON.parse(fs.readFileSync('public/assets/v2/manifest.json','utf8'));
 if(fs.readFileSync('src/generated/art-manifest.json','utf8')!==fs.readFileSync('public/assets/v2/manifest.json','utf8'))throw new Error('Generated source/gallery manifests differ. Run pack-art.mjs; original artwork is never rewritten.');
 if(release&&!manifest.distribution.publicDistributionAuthorized)throw new Error('BLOCKED_ASSET_DISTRIBUTION: current user-supplied graphics are authorized for local school use only, not redistribution/public hosting.');
 if(Object.keys(manifest.heroes).length!==18)throw new Error('Expected all 18 heroes');
 for(const[url,hash]of Object.entries(manifest.files))if(sha256(fs.readFileSync('public'+url))!==hash)throw new Error(`Runtime asset hash mismatch: ${url}`);
 for(const[id,hero]of Object.entries(manifest.heroes)){
  for(const key of ['idle','run','attack','skill1','skill2','hit','dead'])if(!hero.anims[hero.clips[key]]?.frames.length)throw new Error(`Missing clip ${id}/${key}`);
  for(const[clip,anim]of Object.entries(hero.anims))for(const f of anim.frames){
   const r=f.data;if(!(r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=hero.width&&r.y+r.h<=hero.height))throw new Error(`Frame out of bounds: ${id}/${clip}`);
   if(!(f.duration>0&&f.pivot.length===2&&f.sourceSize.length===2))throw new Error(`Frame metadata invalid: ${id}/${clip}`);
   for(const name of ['feet','mainHand','offHand','projectileOrigin'])if(!f.sockets[name]?.every(Number.isFinite))throw new Error(`Socket missing: ${id}/${clip}/${name}`);
  }
  for(const a of Object.values(hero.actions))if(a.releaseFrame<0||a.releaseFrame>=hero.anims[a.clip].frames.length)throw new Error(`Release out of bounds: ${id}`);
 }
 console.log('Art contracts valid: original/runtime hashes, 18 native sheets, variable clips, pivots, sockets and release markers. Not aesthetic approval or distribution permission.');return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))validateArt({release:process.argv.includes('--release')});
