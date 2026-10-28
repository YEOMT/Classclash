import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const manifestPath='dist/client/assets/v2/manifest.json';
const manifest=fs.existsSync(manifestPath)?fs.readFileSync(manifestPath):null;
let commitSha=process.env.COMMIT_SHA||null;
if(!commitSha){try{commitSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}}
const result={appVersion:JSON.parse(fs.readFileSync('package.json','utf8')).version,commitSha,buildTime:process.env.BUILD_TIME||new Date().toISOString(),assetManifestHash:manifest?createHash('sha256').update(manifest).digest('hex'):null,protocolVersion:'classclash-ws-2'};
fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/build-info.json',JSON.stringify(result,null,2)+'\n');
console.log('Build identity:',JSON.stringify(result));
