import type {CombatUnit} from '../shared/combat-types.js';
import {HERO_BY_ID} from '../shared/heroes.js';
import {CHAMPION_CONTRACT,requireChampionArt,nativeLoopFrame,type ChampionArt,type NativeFrame} from './art-contract.js';

export type {NativeFrame,ChampionArt};
export const CHAMPION_ART=CHAMPION_CONTRACT;
export function championPortrait(id:string,className=''){
 const s=CHAMPION_ART[id],r=s?.anims.idle?.frames[0]?.data;if(!s||!r)return '';
 const escape=(text:string)=>text.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
 return `<span class="pixel-portrait native-portrait ${escape(className)}" title="${escape(s.name)} 외형" role="img" aria-label="${escape(HERO_BY_ID[id]!.name+' · '+s.name)}"><svg viewBox="${r.x} ${r.y} ${r.w} ${r.h}" width="64" height="64"><image href="${s.sheet}" width="${s.width}" height="${s.height}"/></svg></span>`;
}

/** Native atlas clips retain every source frame. Combat releases are retimed to
 * the server impact tick; idle/run/death use the source frame durations. */
export function sampleChampion(unit:CombatUnit,tick:number,hurtTick=-Infinity,spec:ChampionArt=requireChampionArt(unit.heroDefinitionId!)){
 let key='idle',elapsed=tick*50,loop=true,index=0;
 const action=unit.action;
 if(unit.state==='DEAD'){key='dead';elapsed=Math.max(0,tick-(unit.deathTick??tick))*50;loop=false;}
 else if(action&&!action.cancelled){
  key=action.skillId?(HERO_BY_ID[unit.heroDefinitionId!]!.skillIds[1]===action.skillId?'skill2':'skill1'):'attack';
  const binding=spec.actions[key]!,clip=binding.clip,frames=spec.anims[clip]!.frames,count=frames.length;
  const impact=action.impactTicks[0]??unit.impactTick,release=binding.releaseFrame;
  if(tick<impact)index=Math.min(release-1,Math.floor(Math.max(0,tick-action.startTick)/Math.max(1,impact-action.startTick)*release));
  else if(['brawler.flurry','assassin.vital_combo','rune_mage.triple_rune','ancient_one.primordial_fissure'].includes(action.skillId??'')&&action.impactTicks.length>=3){
   const hit=tick<action.impactTicks[1]!?0:tick<action.impactTicks[2]!?1:2;
   index=tick<action.impactTicks[2]!+Math.max(1,action.recoveryEndTick-action.impactTicks[2]!)*.5?binding.multiHitFrames[hit]!:count-1;
  }else index=Math.min(count-1,release+Math.floor((tick-impact)/Math.max(1,action.recoveryEndTick-impact)*(count-release)));
  index=Math.max(0,index);
  return {clip,index,mirror:unit.facingX<0,frame:frames[index]!};
 }else if(tick>=hurtTick&&tick-hurtTick<3){key='hit';elapsed=(tick-hurtTick)*50;loop=false;}
 else if(Math.hypot(unit.vx,unit.vy)>1){key='run';}
 const clip=spec.clips[key]!,frames=spec.anims[clip]!.frames;
 index=nativeLoopFrame(frames,elapsed,loop);
 return {clip,index,mirror:unit.facingX<0,frame:frames[index]!};
}
