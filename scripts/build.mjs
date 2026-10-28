import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const roots=['assets/source','public/assets/champions','public/assets/maps','public/assets/world','public/assets/heroes'];
const fingerprint=()=>{const output={};for(const root of roots){if(!fs.existsSync(root))continue;const walk=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else output[file.replaceAll('\\','/')]=createHash('sha256').update(fs.readFileSync(file)).digest('hex');}};walk(root);}return output;};
const before=fingerprint();
const run=script=>execFileSync(process.execPath,[script],{stdio:'inherit',windowsHide:true});
try {
 run('scripts/pack-art.mjs');
 run('scripts/validate-art.mjs');
 run('scripts/validate-rework-assets.mjs');
 const {build}=await import('vite');await build();
 const {build:bundle}=await import('esbuild');await bundle({entryPoints:['src/server/index.ts'],platform:'node',packages:'external',bundle:true,format:'esm',outfile:'dist/server.js'});
 run('scripts/write-build-info.mjs');
} finally {
 const after=fingerprint();const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(file=>before[file]!==after[file]);
 fs.mkdirSync('artifacts/v02',{recursive:true});fs.writeFileSync('artifacts/v02/build-source-preservation.json',JSON.stringify({status:changed.length?'FAIL':'PASS',sourceFiles:Object.keys(before).length,changed,sourceManifestHash:createHash('sha256').update(JSON.stringify(before)).digest('hex')},null,2)+'\n');
 if(changed.length)throw new Error('Build modified source artwork: '+changed.join(', '));
 console.log(`Verified ${Object.keys(before).length} original artwork/source files unchanged by build.`);
}
