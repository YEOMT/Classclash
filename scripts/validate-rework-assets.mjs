import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const art=JSON.parse(fs.readFileSync('src/shared/champion-art.json','utf8'));
const provenance=JSON.parse(fs.readFileSync('assets/source/jungle-rework/provenance.json','utf8'));
assert.equal(Object.keys(art).length,18);
assert.deepEqual(art,JSON.parse(fs.readFileSync('public/assets/champions/manifest.json','utf8')));
for(const asset of [provenance.map,...provenance.champions])assert.equal(createHash('sha256').update(fs.readFileSync(asset.file)).digest('hex'),asset.sha256,asset.file);
for(const [id,s]of Object.entries(art)){
 const png=fs.readFileSync('public'+s.sheet);assert.equal(png.readUInt32BE(16),s.width);assert.equal(png.readUInt32BE(20),s.height);
 for(const name of Object.values(s.clips)){const frames=s.anims[name]?.frames;assert.ok(frames?.length,id+name);for(const f of frames){const r=f.data;assert.ok(f.duration>0&&r.x>=0&&r.y>=0&&r.x+r.w<=s.width&&r.y+r.h<=s.height,id+name);}}
}
console.log('Validated LOL map and 18 native champion atlases with original source checksums.');
