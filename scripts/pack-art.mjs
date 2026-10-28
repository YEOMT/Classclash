// Packaging only: native user-supplied raster/fanim bytes are never regenerated.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export function assertSourcesUnchanged(lock=read('assets/art-source/source-lock.json')){
 for(const[file,hash]of Object.entries(lock.files))if(!fs.existsSync(file)||sha256(fs.readFileSync(file))!==hash)throw new Error(`Approved art source changed: ${file}. Review and explicitly update the source lock; build never restores or overwrites it.`);
 return lock;
}
export function packArt(){
 const lock=assertSourcesUnchanged(),source=read('public/assets/champions/manifest.json'),provenance=read('assets/source/jungle-rework/provenance.json');
 const files={},heroes={};
 const record=url=>{files[url]=sha256(fs.readFileSync('public'+url));return url;};
 for(const[id,entry]of Object.entries(source)){
  const anims={},actions={};
  for(const[clip,animation]of Object.entries(entry.anims)){
   anims[clip]={frames:animation.frames.map(frame=>({...frame,pivot:[frame.data.w*.5,frame.data.h*.92],sourceSize:[frame.data.w,frame.data.h],
    sockets:{feet:[frame.data.w*.5,frame.data.h*.92],mainHand:[frame.data.w*.67,frame.data.h*.55],offHand:[frame.data.w*.5,frame.data.h*.57],projectileOrigin:[frame.data.w*.76,frame.data.h*.56]},
    socketQuality:'NORMALIZED_VISUAL_ANCHOR_REQUIRES_PER_FRAME_ART_REVIEW',
   }))};
  }
  for(const key of ['attack','skill1','skill2']){
   const clip=entry.clips[key],count=anims[clip].frames.length,releaseFrame=Math.min(count-1,Math.max(0,Math.floor(count*.45)));
   actions[key]={clip,releaseFrame,multiHitFrames:[releaseFrame,Math.min(count-1,releaseFrame+1),Math.min(count-1,releaseFrame+2)],cancel:'STOP_UNRELEASED_ACTION',timing:'AUTHORITATIVE_SERVER_ACTION'};
  }
  record(entry.sheet);
  record(`/assets/champions/${id}.json`);
  heroes[id]={...entry,heroId:id,assetVersion:'0.2-native-preserved',sourceHash:provenance.champions.find(c=>c.id===id)?.sha256,bodyBoundsAreCollisionBounds:false,directionMode:'native-side-mirrored',drawnViews:2,license:'USER_SUPPLIED_LOCAL_SCHOOL_USE_NO_REDISTRIBUTION_GRANT',anims,actions};
 }
 record('/assets/maps/lol/background.png');
 const world=read('assets/source/world-assets/runtime.json');
 for(const file of ['effects.png',...Object.values(world.minions).map(s=>s.file),...Object.values(world.structures).map(s=>s.file)])record('/assets/world/'+file);
 const result={schemaVersion:2,assetVersion:'0.2-native-preserved',sourceLockHash:sha256(fs.readFileSync('assets/art-source/source-lock.json')),distribution:{status:'LOCAL_SCHOOL_USE_ONLY',publicDistributionAuthorized:false,reason:'User authorized educational school use without redistribution. No third-party redistribution license is inferred.'},heroes,world,files};
 const serialized=JSON.stringify(result,null,2)+'\n';
 // Vite serves public assets verbatim and forbids importing them as source in
 // development. Generate an identical module copy without touching originals.
 fs.mkdirSync('public/assets/v2',{recursive:true});fs.writeFileSync('public/assets/v2/manifest.json',serialized);
 fs.mkdirSync('src/generated',{recursive:true});fs.writeFileSync('src/generated/art-manifest.json',serialized);assertSourcesUnchanged(lock);
 console.log(`Packed ${Object.keys(heroes).length} preserved native champions and ${Object.keys(files).length} existing files. Original SHA-256 unchanged.`);return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))packArt();
