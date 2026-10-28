import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { HEROES, HERO_BY_ID, SKILLS, heroStats } from '../src/shared/heroes.js';

const json=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
test('18 heroes preserve reference stats, rarity pools and exactly two unlock skills',()=>{
 const ref=json('docs/specification/heroes.reference.json');
 assert.equal(HEROES.length,18);assert.equal(Object.keys(SKILLS).length,36);
 assert.equal(new Set(HEROES.map(h=>h.id)).size,18);
 for(const h of ref.heroes){const actual=HERO_BY_ID[h.id];assert.ok(actual,h.id);assert.deepEqual(actual.baseStats,h.baseStats,h.id);assert.equal(actual.rarity,h.rarity);assert.equal(actual.role,h.role);assert.deepEqual(actual.skillIds,h.skillIds);assert.equal(actual.skills.length,2);assert.deepEqual(actual.skills.map(s=>s.unlockLevel),[2,5]);}
 assert.deepEqual(HEROES.filter(h=>h.rarity==='LEGENDARY').map(h=>h.id),['rune_mage','ancient_one','guardian_spirit']);
 assert.deepEqual(['COMMON','ADVANCED','LEGENDARY'].map(r=>HEROES.filter(h=>h.rarity===r).length),[9,6,3]);
});
test('growth rounds once, remains independent and does not change speed/range/timing',()=>{
 for(const h of HEROES){const a=heroStats(h.id,5,2,1),b=heroStats(h.id,1,0,0);assert.equal(a.hp,Math.round(h.baseStats.hp*1.48*1.08));assert.equal(a.power,Math.round(h.baseStats.power*1.4*1.12));assert.equal(a.armor,h.baseStats.armor+8);for(const k of ['range','speed','attackIntervalMs','windupMs','projectileSpeed','radius'] as const)assert.equal(a[k],b[k]);assert.deepEqual(b,h.baseStats);}
});
test('36 timelines have tick-aligned starts and distinct mechanisms',()=>{
 for(const s of Object.values(SKILLS)){assert.ok(s.cooldownMs>0,s.id);assert.ok(s.hitTimesMs.length>0);assert.ok(s.hitTimesMs.every((t,i)=>t>=s.windupMs&&t%50===0&&(i===0||t>s.hitTimesMs[i-1])),s.id);assert.ok(s.structureMultiplier>=0&&s.structureMultiplier<=.35);assert.ok(s.triggerDescription.length>10);assert.ok(s.effect.length>0);}
 assert.ok(new Set(Object.values(SKILLS).map(s=>s.kind)).size>=20);
 assert.deepEqual(SKILLS['brawler.flurry'].hitTimesMs,[150,300,450]);
 assert.deepEqual(SKILLS['assassin.vital_combo'].hitTimesMs,[150,350,550]);
 assert.deepEqual(SKILLS['archer.arrow_rain'].hitTimesMs,[500,850,1200]);
 assert.deepEqual(SKILLS['rune_mage.triple_rune'].hitTimesMs,[250,400,550]);
 assert.deepEqual(SKILLS['ancient_one.primordial_fissure'].hitTimesMs,[600,700,800]);
 assert.equal(SKILLS['pyromancer.flame_wall'].hitTimesMs.length,6);
 assert.equal(SKILLS['stormcaller.chain_lightning'].radius,70);
 assert.equal(SKILLS['swordsman.parry'].allowDuringBasicRecovery,true);
 assert.equal(Object.values(SKILLS).filter(s=>s.allowDuringBasicRecovery).length,1);
 assert.ok(HERO_BY_ID.guardian_spirit.skills.every(s=>!s.kind.startsWith('heal')));
});
function decodePng(file:string){
 const bytes=fs.readFileSync(file);assert.equal(bytes.subarray(1,4).toString(),'PNG');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),chunks:Buffer[]=[];
 assert.equal(bytes[24],8);assert.equal(bytes[25],6,'RGBA PNG');
 for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p),type=bytes.subarray(p+4,p+8).toString();if(type==='IDAT')chunks.push(bytes.subarray(p+8,p+8+n));p+=12+n;}
 const raw=zlib.inflateSync(Buffer.concat(chunks)),rgba=Buffer.alloc(width*height*4),stride=width*4;
 const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)]!;assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?rgba[i-4]!:0,b=y?rgba[i-stride]!:0,c=y&&x>=4?rgba[i-stride-4]!:0;
   rgba[i]=(raw[y*(stride+1)+1+x]!+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]!)&255;
  }
 }
 return{width,height,rgba};
}

test('acquired raster PNGs have visible complete motions, distinct actions and unique silhouettes',()=>{
 const manifest=json('public/assets/heroes/manifest.json');assert.equal(Object.keys(manifest.heroes).length,18);assert.equal(manifest.directionMode,'side-mirrored');
 const silhouettes=new Set<string>();
 for(const h of HEROES){const meta=json(`public/assets/heroes/${h.id}.json`),png=decodePng(`public/assets/heroes/${h.id}.png`);assert.equal(png.width,512);assert.equal(png.height,320);assert.deepEqual(meta.pivot,[32,52]);
  const actionHashes:Record<string,string>={};
  for(const [state,info] of Object.entries(manifest.states) as [string,{count:number}][]){const anim=meta.animations[state];assert.equal(anim.frames.length,info.count);const hashes=[];
   for(const frame of anim.frames){let opaque=0;const data=Buffer.alloc(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const src=((frame.y+y)*png.width+frame.x+x)*4,dst=(y*64+x)*4;png.rgba.copy(data,dst,src,src+4);if(data[dst+3]>0)opaque++;}assert.ok(opaque>=110,`${h.id}/${state} blank (${opaque})`);hashes.push(crypto.createHash('sha256').update(data).digest('hex'));if(state==='idle'&&hashes.length===1){const silhouette=Buffer.from(Array.from({length:4096},(_,i)=>data[i*4+3]?1:0));silhouettes.add(crypto.createHash('sha256').update(silhouette).digest('hex'));}}
   actionHashes[state]=hashes.join('|');
   if(['walk','basicAttack','skill1','skill2','death'].includes(state))assert.ok(new Set(hashes).size>=3,`${h.id}/${state} needs real pose changes`);
  }
  assert.equal(new Set(['basicAttack','skill1','skill2'].map(s=>actionHashes[s])).size,3,`${h.id} duplicate actions`);
 }
 assert.equal(silhouettes.size,18,'No two heroes differ only by palette');
});
