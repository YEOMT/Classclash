// Validate the acquired-raster motion atlases. No runtime/procedural anatomy.
// Rebuild intentionally with scripts/build-asset-motion.py (Python + Pillow).
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/assets/heroes/manifest.json'),'utf8'));
const ids=JSON.parse(fs.readFileSync(path.join(root,'assets/source/heroes.json'),'utf8')).map(h=>h.id);
if(manifest.revision!=='asset-motion-01'||manifest.directionMode!=='side-mirrored')throw new Error('Unexpected motion layout');
for(const id of ids){
 const entry=manifest.heroes[id];
 if(!entry)throw new Error(`Missing combat atlas: ${id}`);
 for(const url of [entry.image,entry.metadata,`/assets/heroes/${id}-portrait.png`]){
  if(!fs.existsSync(path.join(root,'public',url)))throw new Error(`Missing asset: ${url}`);
 }
 const meta=JSON.parse(fs.readFileSync(path.join(root,'public',entry.metadata),'utf8'));
 if(!meta.animations||!meta.pivot)throw new Error(`Invalid combat metadata: ${id}`);
 const png=fs.readFileSync(path.join(root,'public',entry.image));
 if(png.readUInt32BE(16)!==512||png.readUInt32BE(20)!==320||meta.poses.length!==36)throw new Error(`Invalid atlas layout: ${id}`);
 for(const [state,spec] of Object.entries(manifest.states))if(meta.animations[state]?.frames.length!==spec.count)throw new Error(`Missing animation ${id}/${state}`);
}
console.log(`Validated ${ids.length} acquired-raster motion atlases; 36 timeline poses each, shared left/right textures.`);
const world=JSON.parse(fs.readFileSync('public/assets/world/manifest.json','utf8'));
const runtime=JSON.parse(fs.readFileSync('assets/source/world-assets/runtime.json','utf8'));
if(JSON.stringify(world)!==JSON.stringify(runtime))throw new Error('Rebuild world assets: runtime manifest mismatch');
for(const file of ['battlefield.png','effects.png',...Object.values(world.minions).map(s=>s.file),...Object.values(world.structures).map(s=>s.file)]){
 if(!fs.existsSync(path.join('public/assets/world',file)))throw new Error(`Missing world raster: ${file}`);
}
console.log(`Validated world rasters: ${Object.keys(world.effects).length} effect clips, 4 minion atlases, 8 structures.`);
