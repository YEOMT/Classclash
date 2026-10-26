import test from 'node:test';
import assert from 'node:assert/strict';
import {createCombat,deployHero,stepCombat,applyStatus} from '../src/server/combat.js';
import {HEROES,HERO_BY_ID,SKILLS} from '../src/shared/heroes.js';
import type {CombatState,CombatUnit,Source} from '../src/shared/combat-types.js';
import type {OwnedHero,Team} from '../src/shared/types.js';
let seq=0;
const source=(u:CombatUnit):Source=>({entityId:u.entityId,deploymentId:u.deploymentId,playerId:u.ownerPlayerId,ownedHeroInstanceId:u.ownedHeroInstanceId,heroDefinitionId:u.heroDefinitionId,team:u.team,kind:u.kind,power:u.power,maxHp:u.maxHp});
function scene(){const s=createCombat(`hero-test-${++seq}`,7);s.units=[];s.structures=[];s.events=[];s.nextWaveTick=Infinity;return s;}
function spawn(s:CombatState,id:string,team:Team,x:number,y=224,level=5){const hero:OwnedHero={ownedHeroInstanceId:`owned-${++seq}`,heroDefinitionId:id,rarity:HERO_BY_ID[id].rarity,level,powerEnhancements:0,vitalityEnhancements:0,skillReadyAt:{},obtainedFrom:'STARTER'};const u=deployHero(s,{playerId:`player-${seq}`,team,lane:'TOP',hero,sharedSkillReadyAt:{}});Object.assign(u,{x,y,previousX:x,previousY:y,createdTick:-100,nextAiTick:Infinity,nextBasicReadyTick:Infinity,state:'HOLD',speed:0});for(const sk of HERO_BY_ID[id].skills)u.skillReadyAt[sk.id]=Infinity;return u;}
function run(s:CombatState,n:number){for(let i=0;i<n;i++)stepCombat(s);}
function focus(u:CombatUnit,skillId:string){for(const sk of HERO_BY_ID[u.heroDefinitionId!].skills)u.skillReadyAt[sk.id]=sk.id===skillId?0:Infinity;u.nextAiTick=0;}
function fixture(skillId:string){const s=scene(),id=skillId.split('.')[0],u=spawn(s,id,'A',600);focus(u,skillId);const foes=[spawn(s,'paladin','B',600+u.radius+13+8),spawn(s,'paladin','B',670),spawn(s,'paladin','B',700)];for(const foe of foes){foe.hp=foe.maxHp=5000;foe.armor=0;foe.range=200;}
 const allies=[spawn(s,'priest','A',565,194),spawn(s,'archer','A',565,254),spawn(s,'bard','A',535,224)];for(const ally of allies){ally.hp=ally.maxHp*.4;ally.targetId=foes[0].entityId;}for(let i=0;i<foes.length;i++)foes[i].targetId=allies[i].entityId;u.targetId=foes[0].entityId;
 if(skillId==='swordsman.parry'){const f=foes[0];f.action={id:'incoming-basic',skillId:null,targetIds:[u.entityId],point:{x:u.x,y:u.y},origin:{x:f.x,y:f.y},direction:{x:-1,y:0},startTick:0,impactTicks:[6],recoveryEndTick:11,processedHits:[],hitIds:[],source:source(f)};f.actionId='incoming-basic';f.impactTick=6;f.recoveryEndTick=11;f.state='WINDUP';f.range=14;}
 if(['barbarian.leap_slam','iron_knight.armored_charge','assassin.shadow_leap'].includes(skillId)){foes.forEach((f,i)=>{f.x=700+i*28;f.y=224;});}
 if(skillId==='monk.repelling_staff')foes[0].targetId=u.entityId;
 if(skillId==='monk.cleansing_bell')applyStatus(s,allies[0],'root',3000,0,source(foes[0]));
 if(skillId==='crossbowman.binding_bolt')foes[0].vx=-10;
 if(skillId==='rune_mage.rune_resonance')foes.forEach(f=>f.marks[`rune:${u.ownedHeroInstanceId}`]={count:1,untilTick:200});
 if(skillId==='guardian_spirit.soul_guard'){allies[0].x=590;allies[0].y=190;foes[0].targetId=allies[0].entityId;}
 if(skillId==='guardian_spirit.guardian_barrier')u.targetId=foes[0].entityId;
 return{s,u,foes,allies};}

for(const hero of HEROES)for(const skill of hero.skills)test(`${skill.id}: real AI reserves cooldown, produces impact and applies its mechanic`,()=>{
 const {s,u,foes,allies}=fixture(skill.id),before=foes.map(f=>f.hp),friendlyBefore=[u,...allies].map(f=>f.hp);
 run(s,60);const casts=s.events.filter(e=>e.type==='SKILL_CAST'&&e.params.skillId===skill.id),impacts=s.events.filter(e=>e.type==='SKILL_IMPACT'&&e.params.skillId===skill.id);
 assert.equal(casts.length,1,`${skill.id} must choose a valid cast`);assert.ok(impacts.length>0,`${skill.id} emitted no actual impact`);assert.ok(u.skillReadyAt[skill.id]>s.tick);assert.equal(s.cooldowns[u.ownerPlayerId!].shared[skill.id],u.skillReadyAt[skill.id]);
 if(['shield','shield_area','cleanse_area','taunt','barrier'].includes(skill.kind))assert.ok(s.events.some(e=>e.type==='SHIELD'&&e.sourceEntityId===u.entityId),`${skill.id} did not apply shield`);
 else if(skill.kind.startsWith('heal'))assert.ok([u,...allies].some((a,i)=>a.hp>friendlyBefore[i]),`${skill.id} did not heal`);
 else if(skill.kind==='buff_area')assert.ok(allies.some(a=>a.statuses.some(st=>st.type==='attackHaste')),'melody did not buff');
 else if(skill.kind==='defense')assert.ok(u.statuses.some(st=>st.type==='damageReduction'),'iron wall missing reduction');
 else assert.ok(foes.some((f,i)=>f.hp<before[i]),`${skill.id} did not damage any real target`);
});

test('rune marks belong to the caster and resonance consumes only its own marks',()=>{
 const {s,u,foes}=fixture('rune_mage.rune_resonance'),other=spawn(s,'rune_mage','A',530,192);for(const f of foes)f.marks[`rune:${other.ownedHeroInstanceId}`]={count:1,untilTick:200};run(s,20);
 for(const f of foes){assert.equal(f.marks[`rune:${u.ownedHeroInstanceId}`],undefined);assert.ok(f.marks[`rune:${other.ownedHeroInstanceId}`]);}
});
test('rune resonance overlap caps one target at 150% damage',()=>{
 const {s,u,foes}=fixture('rune_mage.rune_resonance');foes[0].x=650;foes[0].y=224;foes[1].x=676;foes[1].y=210;foes[2].x=676;foes[2].y=238;run(s,14);
 const hits=s.events.filter(e=>e.type==='HIT'&&e.effectId==='rune_mage.rune_resonance'&&e.targetEntityIds.includes(foes[0].entityId));const total=hits.reduce((n,e)=>n+Number(e.params.value),0);assert.ok(total>1.8*u.power);assert.ok(total<=1.8*u.power*1.5+1e-6);
});
test('ancient sigil stacks do not combine across owned hero instances',()=>{
 const {s,u,foes}=fixture('ancient_one.shatter_sigil'),f=foes[0],other=spawn(s,'ancient_one','A',560,190);f.marks[`sigil:${u.ownedHeroInstanceId}`]={count:1,untilTick:120};f.marks[`sigil:${other.ownedHeroInstanceId}`]={count:2,untilTick:120};run(s,10);
 assert.equal(f.marks[`sigil:${u.ownedHeroInstanceId}`]?.count,2);assert.equal(f.marks[`sigil:${other.ownedHeroInstanceId}`]?.count,2);assert.equal(s.events.filter(e=>e.type==='MARK_BURST').length,0);
});
test('strong CC stops unfinished casts; cooldown remains reserved',()=>{
 const {s,u,foes}=fixture('pyromancer.fire_burst');run(s,1);assert.ok(u.action);const ready=u.skillReadyAt['pyromancer.fire_burst'];applyStatus(s,u,'stun',1000,0,source(foes[0]));run(s,20);assert.equal(u.skillReadyAt['pyromancer.fire_burst'],ready);assert.equal(s.events.filter(e=>e.type==='PROJECTILE_SPAWN'&&e.sourceEntityId===u.entityId).length,0);assert.equal(s.events.filter(e=>e.type==='HIT'&&e.sourceEntityId===u.entityId).length,0);
});
test('root allows a started ranged skill; it does not grant hard CC immunity',()=>{
 const {s,u,foes}=fixture('pyromancer.fire_burst');run(s,1);applyStatus(s,u,'root',1000,0,source(foes[0]));run(s,25);assert.ok(s.events.some(e=>e.type==='HIT'&&e.sourceEntityId===u.entityId));assert.equal(u.hardCcImmuneUntilTick,0);
});
test('guardian barrier is fixed in place and ends when its caster dies',()=>{
 const {s,u}=fixture('guardian_spirit.guardian_barrier');run(s,12);const e=s.effects.find(e=>e.effectId==='guardian_barrier');assert.ok(e);const x=e.x;u.x+=50;run(s,1);assert.equal(e.x,x);u.hp=0;u.state='DEAD';u.deathTick=s.tick;run(s,1);assert.equal(s.effects.filter(e=>e.effectId==='guardian_barrier').length,0);
});
test('two low-level heroes never cast locked skills',()=>{
 const s=scene(),a=spawn(s,'paladin','A',600,224,1),b=spawn(s,'swordsman','B',636,224,1);a.nextAiTick=b.nextAiTick=0;a.nextBasicReadyTick=b.nextBasicReadyTick=0;run(s,80);assert.equal(s.events.filter(e=>e.type==='SKILL_CAST').length,0);assert.ok(a.hp<a.maxHp||b.hp<b.maxHp);
});

test('binding bolt hits the intercepting minion instead of the chosen hero',()=>{
 const s=scene(),u=spawn(s,'crossbowman','A',600),blocker=spawn(s,'paladin','B',660),target=spawn(s,'paladin','B',740);blocker.kind='MELEE_MINION';blocker.heroDefinitionId=undefined;blocker.ownerPlayerId=undefined;blocker.armor=0;target.armor=0;target.vx=-10;target.targetId=u.entityId;blocker.targetId=u.entityId;u.targetId=target.entityId;focus(u,'crossbowman.binding_bolt');const hp=target.hp;run(s,30);
 assert.ok(blocker.hp<blocker.maxHp);assert.equal(target.hp,hp);assert.ok(s.events.some(e=>e.type==='HIT'&&e.effectId==='crossbowman.binding_bolt'&&e.targetEntityIds.includes(blocker.entityId)));
});
test('chain lightning stops when the next enemy is 100 units away',()=>{
 const s=scene(),u=spawn(s,'stormcaller','A',600),first=spawn(s,'paladin','B',690),second=spawn(s,'paladin','B',790);first.hp=first.maxHp*.2;first.armor=second.armor=0;first.targetId=second.targetId=u.entityId;u.targetId=first.entityId;focus(u,'stormcaller.chain_lightning');const hp=second.hp;run(s,20);assert.ok(first.hp<first.maxHp*.2);assert.equal(second.hp,hp);
});
test('monk cannot begin cleansing while stunned, then clears root without granting immunity',()=>{
 const {s,u,allies,foes}=fixture('monk.cleansing_bell');applyStatus(s,u,'stun',500,0,source(foes[0]));run(s,8);assert.equal(s.events.filter(e=>e.type==='SKILL_CAST'&&e.params.skillId==='monk.cleansing_bell').length,0);run(s,12);assert.ok(!allies[0].statuses.some(st=>st.type==='root'));assert.equal(allies[0].hardCcImmuneUntilTick,0);
});
test('third own sigil consumes three stacks and applies one extra burst',()=>{
 const {s,u,foes}=fixture('ancient_one.shatter_sigil'),f=foes[0];f.marks[`sigil:${u.ownedHeroInstanceId}`]={count:2,untilTick:120};const hp=f.hp;run(s,10);assert.equal(f.marks[`sigil:${u.ownedHeroInstanceId}`],undefined);assert.equal(s.events.filter(e=>e.type==='MARK_BURST').length,1);assert.ok(Math.abs((hp-f.hp)-u.power*2.8)<1e-6);assert.ok(f.statuses.some(st=>st.type==='stun'));
});
test('three bard buffs preserve one 15 percent maximum and a started attack hit time',()=>{
 const {s,u,allies,foes}=fixture('bard.marching_melody');const b=spawn(s,'bard','A',530,194),c=spawn(s,'bard','A',530,254);for(const bard of[b,c]){focus(bard,'bard.marching_melody');bard.targetId=foes[0].entityId;}const target=allies[0];target.action={id:'existing-attack',skillId:null,targetIds:[foes[0].entityId],point:foes[0],origin:target,direction:{x:1,y:0},startTick:0,impactTicks:[19],recoveryEndTick:24,processedHits:[],hitIds:[],source:source(target)};target.impactTick=19;target.recoveryEndTick=24;run(s,12);assert.equal(target.action?.impactTicks[0],19);assert.equal(Math.max(...target.statuses.filter(st=>st.type==='attackHaste').map(st=>st.magnitude)),.15);assert.ok(s.events.filter(e=>e.type==='SKILL_CAST'&&e.params.skillId==='bard.marching_melody').length>=2);assert.equal(u.skillReadyAt['bard.marching_melody'],241);
});
