import { setupBots, progressToBattle } from './simulate.js';
import { tickRoom } from '../src/server/room.js';
const room=setupBots(Number(process.env.SEED??1001));progressToBattle(room);
const seconds=Number(process.env.SECONDS??180);
for(let i=0;i<seconds*20;i++)tickRoom(room);
const s=room.combat!;
console.log(JSON.stringify({seconds:(s.tick-s.battleStartTick)/20,structures:s.structures.map(u=>({id:u.entityId.split(':').at(-1),hp:Math.round(u.hp),target:u.targetId})),heroes:s.units.filter(u=>u.kind==='HERO').map(u=>({team:u.team,id:u.heroDefinitionId,hp:Math.round(u.hp),x:Math.round(u.x),y:Math.round(u.y),state:u.state,target:s.units.find(t=>t.entityId===u.targetId)?.heroDefinitionId??s.structures.find(t=>t.entityId===u.targetId)?.kind,reason:u.debugReason})),metrics:s.metrics,heroDamage:Object.values(s.stats).reduce((n,x)=>n+x.heroDamage,0),siege:Object.values(s.stats).reduce((n,x)=>n+x.structureDamage,0)},null,2));
