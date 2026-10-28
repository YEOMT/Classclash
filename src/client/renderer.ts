import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { CombatEvent, CombatState, CombatUnit } from '../shared/combat-types.js';
import { HERO_BY_ID, SKILLS } from '../shared/heroes.js';
import BALANCE from '../shared/balance.js';
import {shouldPlayDeliveredEvent} from './event-playback.js';
import {CHAMPION_ART,sampleChampion} from './champion-animation.js';
import {monsterTexture} from './monster-art.js';
import {stableFacing,socketOffset} from './art-contract.js';
import {soundProfile} from './combat-audio.js';

import {WorldArt,minionPose,projectileArt,impactArt} from './world-art.js';

const MAP_WIDTH=BALANCE.map.width,MAP_HEIGHT=BALANCE.map.height;
const reworkedHeroes=new Set(['paladin','brawler','pyromancer']);
const BLUE=0x77d3f2, RED=0xf09a8b;
const colorOf=(team:string)=>team==='A'?BLUE:team==='B'?RED:0xe8d48b;
// The shipped catalog is PNG-only. Avoid optional bitmap worker/format probes whose
// unresolved support checks can otherwise prevent every atlas request from starting.
const textureSetup=Assets.init({skipDetections:true,preferences:{preferWorkers:false,preferCreateImageBitmap:false}});
interface VisualUnit { container:Container; sprite:Sprite; bar:Graphics; label?:Text; lastLabel?:string; lastLabelScale?:number; lastHealth?:string; mirrored?:boolean; }
interface Transient {event:CombatEvent;expires:number;presented:boolean}
interface HitResponse { tick:number; x:number; y:number; strength:number }
export class BattleRenderer {
 readonly app=new Application(); private artwork=new WorldArt(); private world=new Container();private units=new Map<string,VisualUnit>();private frames=new Map<string,Texture[]>();private monsters=new Map<string,Texture>();private structures=new Map<string,Texture>();private minions=new Map<string,Texture[]>();
 private effects=new Graphics();private projectiles=new Graphics();private impacts=new Graphics();private marks=new Graphics();private scenery:Texture|null=null;private state:CombatState|null=null;private receivedAt=performance.now();private transient:Transient[]=[];private seen=new Set<string>();private matchId='';private camera={x:MAP_WIDTH/2,y:MAP_HEIGHT/2};private targetId:string|null=null;private host=true;private lowPerformance=false;private destroyed=false;private observer:ResizeObserver|null=null;private available=false;
 private entityIndex=new Map<string,CombatUnit>();private renderUnits:CombatUnit[]=[];private aliveIds=new Set<string>();private hitResponse=new Map<string,HitResponse>();
 private campLabels=new Map<string,Text>();private followPlayer:string|null=null;private names=new Map<string,string>();private soundEnabled=false;private audio:AudioContext|null=null;private lastSound=0;private soundVolume=.65;private quizDucking=false;private voices=0;private zoom:number|null=null;
 readonly metrics={frames:0,frameMs:[] as number[],sceneUpdateCpuMs:[] as number[],renderSubmissionCpuMs:[] as number[],eventsReceived:0,eventsConsumed:0,eventsPresented:0,recoveryEvents:0,recoveryEventsSkipped:0,replayedCurrent:0,duplicates:0,worldArt:this.artwork.metrics,assetErrors:[] as string[]};
 async init(el:HTMLElement,host:boolean){this.host=host;await this.app.init({resizeTo:el,background:0x22362d,antialias:false,resolution:this.lowPerformance?.75:Math.min(devicePixelRatio,2),autoDensity:true,roundPixels:true,preference:'webgl',powerPreference:'high-performance'});if(this.destroyed){this.app.destroy(true);return;}el.appendChild(this.app.canvas);this.app.stage.addChild(this.world);await textureSetup;try{await this.artwork.load();}catch(error){this.metrics.assetErrors.push('world');this.showAssetError(el,'전장',error);throw error;}if(this.destroyed)return;this.scenery=this.artwork.scenery;this.world.addChild(new Sprite(this.scenery));this.artwork.layer.zIndex=1920;this.artwork.groundLayer.zIndex=950;this.world.addChild(this.artwork.groundLayer,this.artwork.layer);this.world.sortableChildren=true;this.effects.zIndex=900;this.projectiles.zIndex=1900;this.impacts.zIndex=1950;this.marks.zIndex=2000;this.world.addChild(this.effects,this.projectiles,this.impacts,this.marks);this.observer=new ResizeObserver(()=>{if(this.destroyed)return;this.app.resize();this.resize();});this.observer.observe(el);
 await Promise.all(Object.entries(CHAMPION_ART).map(async ([id,spec])=>{try{const base=await Assets.load<Texture>(spec.sheet);if(this.destroyed)return;base.source.scaleMode='nearest';for(const [clip,anim]of Object.entries(spec.anims)){this.frames.set(id+':'+clip,anim.frames.map(({data:r})=>new Texture({source:base.source,frame:new Rectangle(r.x,r.y,r.w,r.h)})));}}catch(error){this.metrics.assetErrors.push(id);this.showAssetError(el,id,error);throw error;}}));
 for(const kind of ['WOLF','GOLEM','WISP'])this.monsters.set(kind,monsterTexture(kind));
 if(this.destroyed)return;
 this.structures=this.artwork.structures;this.minions=this.artwork.minions;
 const submit=this.app.renderer.render.bind(this.app.renderer);this.app.renderer.render=((...args:Parameters<typeof submit>)=>{const start=performance.now();submit(...args);if(this.metrics.renderSubmissionCpuMs.length<18000)this.metrics.renderSubmissionCpuMs.push(performance.now()-start);}) as typeof this.app.renderer.render;this.available=true;this.app.ticker.add(ticker=>{if(!this.destroyed){this.metrics.frames++;if(this.metrics.frameMs.length<18000)this.metrics.frameMs.push(ticker.deltaMS);const before=performance.now();this.render();if(this.metrics.sceneUpdateCpuMs.length<18000)this.metrics.sceneUpdateCpuMs.push(performance.now()-before);}});this.resize();
 }
 private showAssetError(el:HTMLElement,asset:string,error:unknown){this.available=false;if(this.app.canvas){this.app.canvas.hidden=true;this.app.canvas.style.display='none';}const notice=document.createElement('div');notice.className='asset-load-error';notice.setAttribute('role','alert');notice.style.cssText='padding:24px;color:#ffe3c7;background:#30252a;position:relative;z-index:3';const title=document.createElement('p');title.textContent='필수 그래픽을 불러오지 못했습니다: '+asset;const info=document.createElement('p');info.textContent=String(error);const retry=document.createElement('button');retry.textContent='다시 불러오기';retry.onclick=()=>location.reload();notice.append(title,info,retry);el.append(notice);}
 setZoom(value:number){this.zoom=value<=1?1:2;}
 setVolume(value:number){this.soundVolume=Math.max(0,Math.min(1,value));}
 setQuizDucking(value:boolean){this.quizDucking=value;}
 setLowPerformance(enabled:boolean){this.lowPerformance=enabled;if(this.app.renderer){this.app.renderer.resolution=enabled?.75:Math.min(devicePixelRatio,2);this.app.resize();this.resize();}}
 setSound(enabled:boolean){this.soundEnabled=enabled;if(enabled&&!this.audio)this.audio=new AudioContext();if(enabled)void this.audio?.resume();}
 setPlayers(players:{playerId:string;name:string}[]){this.names=new Map(players.map(p=>[p.playerId,p.name]));}
 follow(playerId:string|null){this.followPlayer=playerId;}
 update(state:CombatState|null,paused=false,recovery=false){if(!state)return;if(this.matchId!==state.matchId){this.matchId=state.matchId;this.seen.clear();this.transient=[];this.hurtAt.clear();this.hitResponse.clear();for(const u of this.units.values())u.container.destroy({children:true});this.units.clear();this.camera={x:MAP_WIDTH/2,y:MAP_HEIGHT/2};}
 this.state=state;this.receivedAt=performance.now();this.paused=paused;this.targetId=state.units.find(u=>u.ownerPlayerId===this.followPlayer&&u.state!=='DEAD')?.entityId??null;
 this.renderUnits=[...state.structures,...state.units];this.entityIndex.clear();this.aliveIds.clear();for(const u of this.renderUnits){this.entityIndex.set(u.entityId,u);this.aliveIds.add(u.entityId);}
 for(const e of state.events){if(this.seen.has(e.eventId))continue;this.seen.add(e.eventId);this.metrics.eventsReceived++;if(recovery)this.metrics.recoveryEvents++;if(!shouldPlayDeliveredEvent(e.tick,state.tick,recovery)){this.metrics.recoveryEventsSkipped++;continue;}if(e.type==='HIT'){const source=e.sourceEntityId?this.entityIndex.get(e.sourceEntityId):undefined;for(const id of e.targetEntityIds){if((this.hurtAt.get(id)??-Infinity)>e.tick)continue;this.hurtAt.set(id,e.tick);const target=this.entityIndex.get(id),dx=target&&source?target.x-source.x:source?.facingX??1,dy=target&&source?target.y-source.y:source?.facingY??0,length=Math.hypot(dx,dy)||1;this.hitResponse.set(id,{tick:e.tick,x:dx/length,y:dy/length,strength:reworkedHeroes.has(source?.heroDefinitionId??'')?4:2});}}this.transient.push({event:e,expires:Infinity,presented:false});this.metrics.eventsConsumed++;if(recovery)this.metrics.replayedCurrent++;}
 if(this.seen.size>12000){const live=new Set(state.events.map(e=>e.eventId));this.seen=live;}
 }
 private paused=false;
 private hurtAt=new Map<string,number>();
 private eventDuration(e:CombatEvent){return /DESTROY|DEATH/.test(e.type)?650:e.type==='HIT'&&/^(paladin|brawler|pyromancer)\./.test(e.effectId)?220:/SKILL|SHIELD|HEAL|CC/.test(e.type)?700:350;}
 private playSound(e:CombatEvent){
  if(!this.soundEnabled||!this.audio||this.voices>=6||performance.now()-this.lastSound<35||!/HIT|SKILL|DESTROY|HEAL/.test(e.type))return;
  const distance=Math.hypot(e.x-this.camera.x,e.y-this.camera.y);if(!this.host&&distance>700)return;
  this.lastSound=performance.now();const cue=soundProfile(e.effectId,e.type),oscillator=this.audio.createOscillator(),gain=this.audio.createGain();this.voices++;
  oscillator.type=cue.wave;oscillator.frequency.setValueAtTime(cue.from,this.audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(cue.to,this.audio.currentTime+cue.seconds);
  const attenuation=this.host?.6:Math.max(.18,1-distance/800),volume=.026*this.soundVolume*attenuation*(this.quizDucking?.2:1);
  gain.gain.setValueAtTime(Math.max(.0001,volume),this.audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+cue.seconds);
  oscillator.connect(gain);gain.connect(this.audio.destination);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();this.voices=Math.max(0,this.voices-1);};oscillator.start();oscillator.stop(this.audio.currentTime+cue.seconds+.01);
 }
 private resize(){if(!this.app.renderer)return;const width=this.app.screen.width,height=this.app.screen.height;if(this.host){const s=Math.min(width/(MAP_WIDTH+48),height/(MAP_HEIGHT+48));this.world.scale.set(s);this.world.position.set(Math.round((width-MAP_WIDTH*s)/2),Math.round((height-MAP_HEIGHT*s)/2));} }
 private visual(u:CombatUnit){let v=this.units.get(u.entityId);if(v)return v;const container=new Container(),sprite=new Sprite(Texture.EMPTY),bar=new Graphics();sprite.anchor.set(.5,52/64);sprite.roundPixels=true;container.addChild(sprite,bar);let label:Text|undefined;if(u.kind==='HERO'){label=new Text({text:'',resolution:2,style:{fontFamily:'system-ui',fontSize:11,fill:colorOf(u.team),stroke:{color:0x14241f,width:3},fontWeight:'600'}});label.anchor.set(.5,1);label.roundPixels=true;label.y=-54;container.addChild(label);}this.world.addChild(container);v={container,sprite,bar,label};this.units.set(u.entityId,v);return v;}
 private render(){if(!this.available)return;const b=this.state;if(!b){this.resize();return;}const now=performance.now(),dt=Math.min(100,Math.max(0,now-this.receivedAt)),tick=b.tick+(this.paused?0:dt/50);this.marks.clear();this.artwork.begin();
 for(const u of this.renderUnits){const v=this.visual(u),hero=u.kind==='HERO',structure=['OUTER','INNER','GUARD','NEXUS'].includes(u.kind);const interpolate=this.paused?1:Math.min(1,dt/100);const x=Math.round((u.previousX??u.x)+(u.x-(u.previousX??u.x))*interpolate),y=Math.round((u.previousY??u.y)+(u.y-(u.previousY??u.y))*interpolate);v.container.position.set(x,y);v.container.zIndex=1000+y;v.container.alpha=u.state==='DEAD'?Math.max(.25,1-(tick-(u.deathTick??tick))/16):1;
 if(hero){const pose=sampleChampion(u,tick,this.hurtAt.get(u.entityId)),spec=CHAMPION_ART[u.heroDefinitionId!]!,tex=this.frames.get(u.heroDefinitionId+':'+pose.clip);const frame=pose.frame;const texture=tex?.[pose.index];if(!texture)throw new Error('Missing required native frame '+u.heroDefinitionId+'/'+pose.clip+'/'+pose.index);v.sprite.texture=texture;v.mirrored=stableFacing(u.facingX,v.mirrored??pose.mirror);v.sprite.scale.set(spec.scale*(v.mirrored?-1:1),spec.scale);v.sprite.anchor.set(frame.pivot[0]/frame.data.w,frame.pivot[1]/frame.data.h);}else if(structure){v.sprite.texture=this.structures.get(`${u.team}:${u.kind}`)!;v.sprite.width=128;v.sprite.height=144;v.sprite.anchor.set(.5,126/144);if(u.hp<=0){v.sprite.tint=0x665e50;v.container.alpha=.45;}}else if(u.kind==='MONSTER'){v.sprite.texture=this.monsters.get(u.monsterKind??'WOLF')!;v.sprite.anchor.set(.5,.85);v.sprite.scale.set(u.facingX<0?-1:1,1);v.sprite.rotation=u.action?Math.sin((tick-u.action.startTick)*.7)*.1:0;}else{v.sprite.texture=this.minions.get(`${u.team}:${u.kind}`)![minionPose(u,tick,this.hurtAt.get(u.entityId))]!;v.sprite.width=64;v.sprite.height=40;v.sprite.anchor.set(.5,34/40);v.sprite.scale.x=Math.abs(v.sprite.scale.x)*(u.facingX<0?-1:1);}
 if(u.kind==='MONSTER'&&u.hp>0){const ring=u.monsterKind==='WISP'?0x9df1c6:0xc9ad72;this.marks.ellipse(x,y,22,9).stroke({color:ring,alpha:.5,width:1});}
 const response=this.hitResponse.get(u.entityId),hitAge=tick-(response?.tick??-Infinity),recoil=u.hp>0&&hitAge>=0&&hitAge<3?Math.sin(Math.min(1,hitAge/3)*Math.PI)*(response?.strength??0):0;const airborne=hero?u.statuses.find(s=>s.type==='airborne'&&s.untilTick>tick):undefined;const lift=airborne?Math.sin(Math.min(1,(airborne.untilTick-tick)/13)*Math.PI)*9:0;v.sprite.position.set(Math.round((response?.x??0)*recoil),Math.round((response?.y??0)*recoil-lift+(u.kind==='MONSTER'&&u.monsterKind==='WISP'?Math.sin(tick*.2)*3:0)));
 v.sprite.tint=u.hp>0&&tick-(this.hurtAt.get(u.entityId)??-100)<1.6?0xffd5b5:0xffffff;const healthKey=[u.hp,u.maxHp,u.shield,u.protected,u.state==='DEAD'].join(':');if(v.lastHealth!==healthKey){v.lastHealth=healthKey;v.bar.clear();if(u.hp>0){const width=structure?55:hero?33:18,by=structure?(u.kind==='NEXUS'?-108:-120):hero?-48:-35;v.bar.rect(-width/2-1,by-1,width+2,6).fill(0x162822);v.bar.rect(-width/2,by,width*Math.max(0,u.hp/u.maxHp),3).fill(colorOf(u.team));if(u.shield>0)v.bar.rect(-width/2,by-3,Math.min(width,width*u.shield/u.maxHp),2).fill(0xe8e9c6);if(structure&&u.protected){v.bar.rect(-3,by-12,6,6).fill(0xd7d3af);v.bar.roundRect(-2,by-16,4,6,2).stroke({color:0xd7d3af,width:1});}if(hero){v.bar.moveTo(-3,2).lineTo(0,5).lineTo(3,2).stroke({color:colorOf(u.team),width:2});}}
 }
 if(v.label){const name=this.names.get(u.ownerPlayerId??'')??HERO_BY_ID[u.heroDefinitionId??'']?.name??'',labelScale=this.host?Math.min(1.8,Math.max(1,.8/this.world.scale.x)):(this.app.screen.width>=640?.55:1);if(v.lastLabel!==name){v.label.text=name;v.lastLabel=name;}if(v.lastLabelScale!==labelScale){v.label.scale.set(labelScale);v.lastLabelScale=labelScale;}v.label.visible=u.hp>0;}
 if(hero&&u.hp>0){if(u.entityId===this.targetId)this.marks.ellipse(x,y,18,7).stroke({color:0xf6e5a2,width:2});if(u.shield>0)this.marks.ellipse(x,y-19,20,29).stroke({color:0xb6ecde,alpha:.65,width:2});for(const status of u.statuses){if(status.untilTick<b.tick)continue;if(/stun|airborne/.test(status.type)){for(let i=0;i<3;i++){const a=tick*.15+i*2.094;this.marks.star(x+Math.cos(a)*13,y-52+Math.sin(a)*3,4,3,1).fill(0xf5dc89);}}else if(status.type==='root'){this.marks.poly([x-14,y+2,x-14,y-14,x-8,y-6,x,y-22,x+8,y-6,x+14,y-14,x+14,y+2]).stroke({color:0x9ae5e9,width:2});}else if(status.type==='slow')this.marks.ellipse(x,y,17,6).stroke({color:0x8cc6da,alpha:.7,width:1});else if(status.type==='taunt'){this.marks.rect(x-2,y-66,4,9).fill(0xffcf82);this.marks.rect(x-2,y-54,4,3).fill(0xffcf82);}else if(status.type==='attackHaste'){this.marks.poly([x-13,y+4,x-8,y-3,x-3,y+4]).stroke({color:0xe1a8d3,width:2});this.marks.poly([x+3,y+4,x+8,y-3,x+13,y+4]).stroke({color:0xe1a8d3,width:2});}else if(status.type==='damageReduction'){this.marks.poly([x-19,y-36,x-19,y-9,x-12,y-4]).stroke({color:0xd4e8b2,width:2});this.marks.poly([x+19,y-36,x+19,y-9,x+12,y-4]).stroke({color:0xd4e8b2,width:2});}}if(Object.keys(u.marks??{}).length){this.marks.poly([x,y-63,x+5,y-57,x,y-51,x-5,y-57]).stroke({color:0x8cebd5,width:2});}}
 }
 for(const[id,v]of this.units){if(!this.aliveIds.has(id)){v.container.destroy({children:true});this.units.delete(id);this.hurtAt.delete(id);this.hitResponse.delete(id);}}
 this.effects.clear();this.projectiles.clear();this.impacts.clear();for(const effect of b.effects){const name=effect.effectId;this.drawSkill(this.effects,name,effect.x,effect.y,effect.direction.x,effect.direction.y,effect.radius,effect.width,effect.depth,.55,tick,Boolean(effect.healing),(tick-effect.createdTick)*50,true);}
 for(const p of b.projectiles){const art=projectileArt(p.effectId),source=this.entityIndex.get(p.source.entityId);let socketY=-18;if(source?.kind==='HERO'){const pose=sampleChampion(source,p.createdTick),spec=CHAMPION_ART[source.heroDefinitionId!]!;socketY=socketOffset(pose.frame,'projectileOrigin',pose.mirror,spec.scale).y;}this.artwork.draw(art.clip,p.x,p.y+socketY,(tick-p.createdTick)*50,{loop:true,scale:art.scale,rotation:Math.atan2(p.direction.y,p.direction.x)+art.rotationOffset});}
 this.transient=this.transient.filter(t=>!t.presented||t.expires>now);for(const t of this.transient){if(!t.presented){t.presented=true;t.expires=now+this.eventDuration(t.event);this.metrics.eventsPresented++;this.playSound(t.event);}this.drawEvent(t.event,Math.max(0,Math.min(1,(t.expires-now)/this.eventDuration(t.event))),tick);}
 for(const camp of b.camps??[]){let label=this.campLabels.get(camp.id);if(!label){label=new Text({text:'',style:{fontFamily:'system-ui',fontSize:12,fill:0xe6d59c,stroke:{color:0x14241f,width:3}}});label.anchor.set(.5,0);label.position.set(camp.x,camp.y+13);label.zIndex=1990;this.world.addChild(label);this.campLabels.set(camp.id,label);}const caption=camp.entityId?camp.name:Math.max(0,Math.ceil((camp.respawnTick-b.tick)/20))+'초 후 재생성';if(label.text!==caption)label.text=caption;label.alpha=camp.entityId?.9:.65;}
 this.artwork.end();
 if(!this.host){const target=this.targetId?this.entityIndex.get(this.targetId):null;if(target){this.camera.x+=(target.x+target.facingX*55-this.camera.x)*.12;this.camera.y+=(target.y+target.facingY*30-this.camera.y)*.12;}const s=this.zoom??(this.app.screen.width>=640?2:1);this.world.scale.set(s);const halfW=this.app.screen.width/(2*s),halfH=this.app.screen.height/(2*s);const cx=halfW*2>=MAP_WIDTH?MAP_WIDTH/2:Math.max(halfW,Math.min(MAP_WIDTH-halfW,this.camera.x)),cy=halfH*2>=MAP_HEIGHT?MAP_HEIGHT/2:Math.max(halfH,Math.min(MAP_HEIGHT-halfH,this.camera.y));this.world.position.set(Math.round(this.app.screen.width/2-cx*s),Math.round(this.app.screen.height/2-cy*s));}
 }
 private effectColor(name:string,team:string){if(/fire|flame/.test(name))return 0xf3a45c;if(/frost|ice/.test(name))return 0xa5e6f2;if(/heal|prayer|soul|sanctuary|barrier/.test(name))return 0xb5e6b0;if(/rune/.test(name))return 0x89ecd8;if(/lightning|thunder/.test(name))return 0xf3dd82;if(/shadow|vital/.test(name))return 0xcb9de1;if(/sigil|fissure/.test(name))return 0xdec187;if(/melody|dissonance/.test(name))return 0xe5a8cb;return colorOf(team);}
 private drawSkill(g:Graphics,name:string,x:number,y:number,dx:number,dy:number,radius:number,width:number,depth:number,alpha:number,tick:number,healing=false,ageMs=0,loop=false){
  const r=radius||45,clip=impactArt(name),opts={loop,ground:loop,alpha:alpha*.8};
  if(loop){const color=this.effectColor(name,'A');if(/flame_wall/.test(name)){g.poly(this.rectanglePoints(x,y,dx,dy,width,depth)).fill({color,alpha:.08}).stroke({color,alpha:.7,width:1.5});}else if(radius>0){g.circle(x,y,radius).fill({color,alpha:.045}).stroke({color,alpha:.55,width:1.5});}}
  if(/flame_wall/.test(name)){
   const span=width||110,count=Math.min(7,Math.ceil(span/24));
   for(let i=0;i<count;i++){const offset=(i+.5)/count*span-span/2;this.artwork.draw('fire-pillar',x-dy*offset,y+dx*offset-23,ageMs+i*40,{...opts,scale:.75});}
  }else if(/arrow_rain/.test(name)){
   for(let i=0;i<8;i++){const a=i*2.4,rr=r*Math.sqrt((i+1)/9),drop=(ageMs*.1+i*9)%32;this.artwork.draw('arrow',x+Math.cos(a)*rr,y+Math.sin(a)*rr-24+drop,ageMs,{loop:true,alpha,rotation:Math.PI*.65,scale:2});}
  }else if(/fissure|flash_cut|armored_charge|steel_bolt|piercing_arrow/.test(name)){
   const len=depth||90;for(let i=0;i<3;i++)this.artwork.draw(/fissure/.test(name)?'arc':'slash',x+dx*len*(i+.5)/3,y+dy*len*(i+.5)/3-15,ageMs+i*25,{...opts,scale:.4,rotation:Math.atan2(dy,dx)});
  }else if(/barrier|sanctuary|soul_guard|iron_wall|healing|prayer|cleansing|rune|sigil|melody/.test(name)||healing){
   this.artwork.draw(/rune|sigil/.test(name)?'rune':'ward',x,y-10,ageMs,{...opts,scale:Math.min(2,r/45),alpha:alpha*.5});
   if(healing)this.artwork.draw('holy-star',x,y-30,ageMs,{...opts,scale:.65});
  }else if(/frost_fan|dissonance/.test(name)){
   for(let i=-1;i<=1;i++){const a=Math.atan2(dy,dx)+i*.5;this.artwork.draw(/frost/.test(name)?'ice-pillar':'ward',x+Math.cos(a)*r*.5,y+Math.sin(a)*r*.5-22,ageMs+i*30,{...opts,scale:.7});}
  }else this.artwork.draw(clip,x,y-20,ageMs,{...opts,scale:/spin|slam|roar|fire_burst|ice_prison/.test(name)?Math.min(1.5,r/50):.8});
 }
 private rectanglePoints(x:number,y:number,dx:number,dy:number,width:number,depth:number){return [[-1,-1],[1,-1],[1,1],[-1,1]].flatMap(([a,b])=>[x+dx*a!*depth/2-dy*b!*width/2,y+dy*a!*depth/2+dx*b!*width/2]);}
 private drawEvent(e:CombatEvent,alpha:number,tick:number){const source=e.sourceEntityId?this.entityIndex.get(e.sourceEntityId):undefined,dx=Number(e.params.directionX??source?.facingX??1),dy=Number(e.params.directionY??source?.facingY??0),name=e.effectId||String(e.params.skillId??''),g=this.effects;const color=this.effectColor(name,source?.team??'A'),ageMs=(1-alpha)*this.eventDuration(e);
 if(e.type==='SKILL_CAST'){
  // Telegraphs announce the server's committed shape. The release art waits for impact.
  const impact=Number(e.params.impactTick??e.tick);if(tick<impact){const radius=Number(e.params.radius??0),range=Number(e.params.range??0),width=Number(e.params.width??0),kind=String(e.params.kind??'');
   if(/rectangle/.test(kind))g.poly(this.rectanglePoints(e.x,e.y,dx,dy,width,Number(e.params.depth??40))).stroke({color,alpha:.4,width:1});
   else if(radius>0)g.circle(e.x,e.y,radius).stroke({color,alpha:.35,width:1});
   else if(/line|projectile|charge/.test(kind))g.moveTo(Number(e.params.originX??e.x),Number(e.params.originY??e.y)).lineTo(e.x,e.y).stroke({color,alpha:.3,width:Math.max(1,width*.1)});
   else if(kind==='cone'){const ox=Number(e.params.originX??e.x),oy=Number(e.params.originY??e.y),angle=Math.atan2(dy,dx),half=Number(e.params.angle??90)*Math.PI/360;g.moveTo(ox+Math.cos(angle-half)*range,oy+Math.sin(angle-half)*range).lineTo(ox,oy).lineTo(ox+Math.cos(angle+half)*range,oy+Math.sin(angle+half)*range).stroke({color,alpha:.35,width:1});}
  }
 }
 if(/SKILL_IMPACT|AREA_PULSE|RUNE_DETONATE|FISSURE|PARRY|MARK_BURST/.test(e.type)){const skill=SKILLS[name]??Object.values(SKILLS).find(s=>s.effect===name),projectileRelease=e.type==='SKILL_IMPACT'&&/projectile/.test(skill?.kind??''),confirmedMelee=reworkedHeroes.has(source?.heroDefinitionId??'')&&/^(single|multi_hit)$/.test(skill?.kind??'');const origin=/cone|segmented_line|dash_line/.test(skill?.kind??'');if(!projectileRelease&&!confirmedMelee&&!this.state?.effects.some(effect=>effect.actionId===e.actionId))this.drawSkill(g,name,origin?Number(e.params.originX??e.x):e.x,origin?Number(e.params.originY??e.y):e.y,dx,dy,Number(e.params.radius??skill?.radius??45),Number(e.params.width??skill?.width??0),Number(e.params.length??e.params.depth??skill?.depth??0),alpha,tick,/heal/.test(name),ageMs);}
 if(e.type==='CHAIN'){const x=Number(e.params.fromX??source?.x??e.x),y=Number(e.params.fromY??source?.y??e.y)-18,tx=Number(e.params.toX??e.x),ty=Number(e.params.toY??e.y)-18;
  for(let i=1;i<=4;i++)this.artwork.draw('lightning-hit',x+(tx-x)*i/4,y+(ty-y)*i/4,ageMs,{scale:.5,alpha});
 }
 if(e.type==='KNOCKBACK')g.moveTo(e.x-dx*18,e.y-dy*18).lineTo(e.x,e.y).stroke({color:0xdcd5b8,alpha,width:2});
 if(/^(HIT|HEAL|SHIELD|CLEANSE)$/.test(e.type)){
  for(const targetId of e.targetEntityIds.length?e.targetEntityIds:[null]){const target=targetId?this.entityIndex.get(targetId):null,x=target?.x??e.x,y=(target?.y??e.y)-18;
   const basic=e.params.kind==='basic',clip=e.type==='SHIELD'?'shield':/HEAL|CLEANSE/.test(e.type)?'heal':basic?(/pyro/.test(name)?'fire-hit':'shock'):impactArt(name);
   this.artwork.draw(clip,x,y,ageMs,{scale:basic?.6:.8,alpha});
  }
 }
 if(/DESTROY|DEATH/.test(e.type))this.artwork.draw('smoke',e.x,e.y-15,ageMs,{scale:/DESTROY/.test(e.type)?1.5:.65,alpha});
 }

 destroy(){
  if(this.destroyed)return;this.destroyed=true;this.observer?.disconnect();this.observer=null;
  if(this.app.renderer)this.app.destroy(true,{children:true});
  // Atlas sources belong to Assets and remain shared. Each frame subscribes to
  // its source's resize event, so destroy the views explicitly on every round.
  for(const textures of this.frames.values())for(const texture of textures)texture.destroy(false);
  this.artwork.destroy();for(const t of this.monsters.values())t.destroy(true);this.monsters.clear();
  // World PNG sources stay in Assets; frame views are released by WorldArt.
 this.scenery=null;this.frames.clear();this.structures.clear();this.minions.clear();this.units.clear();
  this.state=null;this.transient=[];this.hurtAt.clear();this.hitResponse.clear();this.entityIndex.clear();this.renderUnits=[];this.aliveIds.clear();this.seen.clear();this.names.clear();this.campLabels.clear();
  void this.audio?.close();this.audio=null;
 }
}



