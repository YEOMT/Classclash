import * as paladin from './compact-paladin.mjs';
import * as archer from './compact-archer.mjs';
import * as pyromancer from './compact-pyromancer.mjs';
import {buffer} from './compact-pixel-core.mjs';

export const COMPACT_IDS=new Set(['paladin','archer','pyromancer']);
export const COMPACT_ART_VERSION=3;
const authors={paladin,archer,pyromancer};
export function nativeSprite(id,state,frame,direction){
 const g=buffer();authors[id].draw(g,state,frame,direction);return g;
}
export function drawCompact(g,hero,state,frame,direction){
 const native=nativeSprite(hero.id,state,frame,direction);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){
  const i=(y*32+x)*4;if(!native.data[i+3])continue;
  const j=((y+22)*g.w+x+16)*4;g.data.set(native.data.subarray(i,i+4),j);
 }
 const v=[[0,1],[.71,.71],[1,0],[.71,-.71],[0,-1],[-.71,-.71],[-1,0],[-.71,.71]][direction];
 return {hand:[32+Math.round(v[0]*6),43+Math.round(v[1]*2)],offhand:[32-Math.round(v[0]*5),43],fx:v[0],fy:v[1]};
}
export const compactArtNotes={
 revision:3,heroes:[...COMPACT_IDS],nativeCanvas:[32,32],atlasCell:[64,64],paddingOffset:[16,22],footPivot:[32,52],
 light:'screen upper-left in all directions',proportion:'2.5–3 head SD; cranial head about 10px, active height about 28–30px',
 authoring:'Explicit pixel clusters and keyed body/limb/equipment poses. No reference sprite extraction or tracing.',
 designs:Object.fromEntries(Object.entries(authors).map(([id,a])=>[id,a.notes])),
 palettes:Object.fromEntries(Object.entries(authors).map(([id,a])=>[id,a.palette])),
};
