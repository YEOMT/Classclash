import fs from 'node:fs';
const path=process.argv[2]||'public/assets/v2/manifest.json';
if(!fs.existsSync(path))throw new Error('BLOCKED_ASSET_LICENSE: reviewed asset manifest is missing');
const manifest=JSON.parse(fs.readFileSync(path,'utf8'));
if(manifest.distribution?.status!=='PUBLIC_REDISTRIBUTION_VERIFIED')throw new Error('BLOCKED_ASSET_LICENSE: local educational use does not establish public redistribution permission. Supply documented rights or replace restricted assets before deployment.');
console.log('Public distribution asset gate passed');
