import {Assets, Container, Rectangle, Sprite, Texture} from 'pixi.js';
import {BATTLE_MAP} from '../shared/battle-map.js';
import catalog from '../../assets/source/world-assets/runtime.json';
import type {CombatUnit} from '../shared/combat-types.js';

interface Clip {frames:number[];durationsMs:number[]}
interface MinionSpec {file:string;cell:number[];columns:number;count:number;clips:Record<string,Clip>}
interface EffectFrame {x:number;y:number;w:number;h:number;durationMs:number}
interface EffectSpec {frames:EffectFrame[]}
const minionSpecs=catalog.minions as Record<string,MinionSpec>;
const effectSpecs=catalog.effects as Record<string,EffectSpec>;

/** Windup and release use the authoritative attack clock, never a free-running loop. */
export function minionPose(unit:CombatUnit,tick:number,hurtTick=-Infinity):number {
 const spec=minionSpecs[`${unit.team}:${unit.kind==='MELEE_MINION'?'melee':'ranged'}`]!;
 if(unit.state==='DEAD') {const frames=spec.clips.death!.frames;return frames[Math.min(frames.length-1,Math.floor(Math.max(0,tick-(unit.deathTick??tick))/2))]!;}
 if(unit.action&&!unit.action.cancelled){const a=unit.action,frames=spec.clips.attack!.frames,impact=a.impactTicks[0]??unit.impactTick;
  if(tick<impact)return frames[Math.min(1,Math.floor(Math.max(0,tick-a.startTick)/Math.max(1,impact-a.startTick)*2))]!;
  return frames[Math.min(frames.length-1,2+Math.floor((tick-impact)/Math.max(1,a.recoveryEndTick-impact)*(frames.length-2)))]!;
 }
 // Original minion atlases have no separate hit clip: keep their actual neutral
 // raster during the short renderer recoil. This never adds gameplay stun.
 if(tick>=hurtTick&&tick-hurtTick<3)return spec.clips.idle!.frames[0]!;
 const frames=spec.clips[Math.hypot(unit.vx,unit.vy)>1?'move':'idle']!.frames;
 return frames[Math.floor(Math.max(0,tick)/2)%frames.length]!;
}

/** Shared source PNGs, cached frame views, and a bounded reusable VFX sprite pool. */
export class WorldArt {
 readonly layer=new Container();readonly groundLayer=new Container();
 readonly minions=new Map<string,Texture[]>();readonly structures=new Map<string,Texture>();
 readonly metrics={peakEffects:0,droppedEffects:0,effectFrames:0};
 scenery:Texture=Texture.EMPTY;
 private effects=new Map<string,Texture[]>();private views:Texture[]=[];private pool:Sprite[]=[];private used=0;private disposed=false;
 async load(){
  const files=['battlefield.png','effects.png',...Object.values(minionSpecs).map(s=>s.file),...Object.values(catalog.structures).map(s=>s.file)];
  const loaded=await Promise.all(files.map(file=>Assets.load<Texture>(file==='battlefield.png'?BATTLE_MAP.artwork:`/assets/world/${file}`)));
  if(this.disposed)return;
  const textures=new Map(files.map((file,i)=>[file,loaded[i]!]));for(const t of loaded)t.source.scaleMode='nearest';
  this.scenery=textures.get('battlefield.png')!;
  for(const [key,spec]of Object.entries(minionSpecs)){
   const base=textures.get(spec.file)!;const frames=Array.from({length:spec.count},(_,i)=>this.frame(base,i%spec.columns*spec.cell[0]!,Math.floor(i/spec.columns)*spec.cell[1]!,spec.cell[0]!,spec.cell[1]!));
   this.minions.set(key.replace('melee','MELEE_MINION').replace('ranged','RANGED_MINION'),frames);
  }
  for(const [key,spec]of Object.entries(catalog.structures))this.structures.set(key,textures.get(spec.file)!);
  const base=textures.get('effects.png')!;
  for(const [key,spec]of Object.entries(effectSpecs))this.effects.set(key,spec.frames.map(f=>this.frame(base,f.x,f.y,f.w,f.h)));
 }
 private frame(base:Texture,x:number,y:number,w:number,h:number){const t=new Texture({source:base.source,frame:new Rectangle(x,y,w,h)});this.views.push(t);return t;}
 begin(){this.used=0;}
 end(){for(let i=this.used;i<this.pool.length;i++)this.pool[i]!.visible=false;this.metrics.peakEffects=Math.max(this.metrics.peakEffects,this.used);}
 draw(key:string,x:number,y:number,ageMs:number,options:{loop?:boolean;scale?:number;alpha?:number;rotation?:number;tint?:number;limit?:number;ground?:boolean}={}){
  const spec=effectSpecs[key],textures=this.effects.get(key);if(!spec||!textures||ageMs<0)return;
  const duration=spec.frames.reduce((n,f)=>n+f.durationMs,0);let at=options.loop?ageMs%duration:ageMs;
  if(at>=duration)return;
  let index=0;for(;index<spec.frames.length-1;index++){const time=spec.frames[index]!.durationMs;if(at<time)break;at-=time;}
  // Only explicitly decorative callers may request a cap. Semantic effects are
  // retained even in low-quality mode; live effect lifetime bounds their pool.
  if(options.limit!==undefined&&this.used>=options.limit){this.metrics.droppedEffects++;return;}
  let sprite=this.pool[this.used++];if(!sprite){sprite=new Sprite();sprite.anchor.set(.5);sprite.roundPixels=true;this.pool.push(sprite);this.layer.addChild(sprite);}
  const parent=options.ground?this.groundLayer:this.layer;if(sprite.parent!==parent)parent.addChild(sprite);
  sprite.visible=true;sprite.texture=textures[index]!;sprite.position.set(Math.round(x),Math.round(y));sprite.scale.set(options.scale??1);sprite.alpha=options.alpha??1;sprite.rotation=options.rotation??0;sprite.tint=options.tint??0xffffff;this.metrics.effectFrames++;
 }
 destroy(){this.disposed=true;for(const t of this.views)t.destroy(false);this.views=[];this.minions.clear();this.structures.clear();this.effects.clear();this.pool=[];}
}

export function projectileArt(name:string):{clip:string;rotationOffset:number;scale:number}{
 if(/fire|flame|pyro/.test(name))return {clip:'fire-ball',rotationOffset:0,scale:1};
 if(/frost|ice|cryo/.test(name))return {clip:'ice-pillar',rotationOffset:-Math.PI/2,scale:.5};
 if(/heal|prayer|spirit/.test(name))return {clip:'heal-bolt',rotationOffset:0,scale:1};
 if(/arrow|bolt|archer|crossbow|ranged_minion/.test(name))return {clip:'arrow',rotationOffset:0,scale:1};
 return {clip:'magic-bolt',rotationOffset:0,scale:1};
}
export function impactArt(name:string):string{
 if(/fire|flame|pyro/.test(name))return 'fire-burst';
 if(/ice|frost|cryo/.test(name))return 'ice-burst';
 if(/shield|sanctuary|barrier|iron_wall|parry/.test(name))return 'shield';
 if(/heal|prayer|cleans|soul_guard/.test(name))return 'heal';
 if(/rune|sigil/.test(name))return 'rune';
 if(/lightning|thunder|storm/.test(name))return 'lightning-hit';
 if(/shadow|vital/.test(name))return 'smoke';
 if(/melody|dissonance/.test(name))return 'ward';
 if(/spin|slam|roar|fissure/.test(name))return 'arc';
 if(/flash_cut|piercing|steel/.test(name))return 'slash';
 return 'shock';
}
