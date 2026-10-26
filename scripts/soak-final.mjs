import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, readdirSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BATCH=process.argv.find(arg=>arg.startsWith('--batch='))?.slice(8)||process.env.SOAK_BATCH||'soak-final40';
if(!/^[a-zA-Z0-9_-]+$/.test(BATCH))throw new Error('SOAK_BATCH must be a plain directory name.');
export const DIRECTORY = resolve(ROOT, 'artifacts', BATCH);
const MANIFEST_PATH = resolve(DIRECTORY, 'manifest.json');
const BASE_PATH = 'artifacts/soak-candidate9-terminals-results.json';
const SOURCE_FILES = [
  'src/server/combat.ts', 'src/server/combat-geometry.ts', 'src/server/room.ts',
  'src/server/quiz.ts', 'src/server/awards.ts', 'src/server/errors.ts', 'src/server/versions.ts',
  'src/shared/heroes.ts', 'src/shared/balance.ts', 'src/shared/bot-balance.ts',
  'src/shared/random.ts', 'src/shared/types.ts', 'src/shared/combat-types.ts',
  'docs/specification/balance.defaults.json', 'scripts/simulate.ts',
];
export const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
export const digest = value => createHash('sha256').update(value).digest('hex');
export const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
export function atomicJSON(path, value) {
  mkdirSync(dirname(path), {recursive:true});
  const temporary = path + '.' + process.pid + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
}
function sourceFingerprints() { return Object.fromEntries(SOURCE_FILES.map(path => [path, digest(readFileSync(resolve(ROOT,path)))])); }
export function loadManifest(verifySources=true) {
  if(!existsSync(MANIFEST_PATH))throw new Error('Run --stage=prepare first; preparation never starts simulations.');
  const manifest=readJSON(MANIFEST_PATH), current=sourceFingerprints();
  for(const [path,hash] of Object.entries(manifest.sourceHashes)) if(verifySources&&current[path]!==hash) throw new Error('Frozen simulation source changed: '+path+'. Do not silently combine different engines/balance.');
  if(manifest.basePath&&digest(readFileSync(resolve(ROOT,manifest.basePath)))!==manifest.baseFileHash)throw new Error('The preserved four-match baseline changed.');
  return manifest;
}
function prepare() {
  const fresh=process.argv.includes('--fresh=1')||process.env.SOAK_FRESH==='1';
  if(existsSync(MANIFEST_PATH)){const manifest=loadManifest();if(fresh&&manifest.basePath)throw new Error('Use a new SOAK_BATCH for a fresh run; existing evidence is preserved.');console.log('Existing frozen manifest retained: '+manifest.manifestId);return manifest;}
  let balance,basePath=null,baseFileHash=null;
  if(fresh){
    const script="import b from './src/shared/balance.ts';process.stdout.write(JSON.stringify({structureStats:b.structureStats,minimumDeadWaitSeconds:b.deployment.minimumDeadWaitSeconds,structureDamagePhases:b.minions.structureDamagePhases}));";
    balance=JSON.parse(execFileSync(process.execPath,[resolve(ROOT,'node_modules/tsx/dist/cli.mjs'),'-e',script],{cwd:ROOT,windowsHide:true,encoding:'utf8'}));
  }else{
    const base=readJSON(resolve(ROOT,BASE_PATH));
    if(base.results.length!==4||base.results.some((r,i)=>r.seed!==1001+i||r.phase!=='RESULT'))throw new Error('Expected the four completed candidate9 seeds1001–1004.');
    balance=base.balance;basePath=BASE_PATH;baseFileHash=digest(readFileSync(resolve(ROOT,BASE_PATH)));
  }
  const core={schemaVersion:2,basePath,baseFileHash,sourceHashes:sourceFingerprints(),balance,firstSeed:1001,lastSeed:1040,matchLimitSeconds:900,profile:'STANDARD',players:30,tickRate:20};
  const manifest={...core,manifestId:digest(canonical(core)),preparedAt:new Date().toISOString(),historicalEvidence:fresh?'Fresh40: all seeds1001–1040 run after this source/balance fingerprint; no historical matches are imported.':'Seeds1001–1004 have original balance metadata and preserved file hash; their source hashes were not recorded at execution. Current source fingerprints apply to continuation seeds1005–1040.'};
  atomicJSON(MANIFEST_PATH,manifest);console.log('Prepared only; no match started. '+manifest.manifestId);return manifest;
}
export const seedPath = seed => resolve(DIRECTORY,'seeds','seed-'+seed+'.json');
function quantile(sorted,p) { if(!sorted.length)return null;const x=(sorted.length-1)*p,low=Math.floor(x),high=Math.ceil(x);return sorted[low]+(sorted[high]-sorted[low])*(x-low); }
function distribution(values) { const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return {count:a.length,min:a[0]??null,p10:quantile(a,.1),p25:quantile(a,.25),median:quantile(a,.5),p75:quantile(a,.75),p90:quantile(a,.9),max:a.at(-1)??null,mean:a.length?a.reduce((s,n)=>s+n,0)/a.length:null}; }
export function collect(manifest) {
  const baseline=manifest.basePath?readJSON(resolve(ROOT,manifest.basePath)):null;
  if(baseline&&canonical(baseline.balance)!==canonical(manifest.balance))throw new Error('Baseline balance differs from manifest.');
  const records=baseline?baseline.results.map(result=>({source:manifest.basePath,historical:true,result})):[];
  const seedsDirectory=resolve(DIRECTORY,'seeds');
  if(existsSync(seedsDirectory))for(const file of readdirSync(seedsDirectory).filter(n=>/^seed-\d+\.json$/.test(n))){
    const record=readJSON(resolve(seedsDirectory,file));
    if(record.manifestId!==manifest.manifestId)throw new Error('Mismatched manifest: '+file);
    if(record.result.seed<(manifest.basePath?1005:1001)||record.result.seed>1040||file!=='seed-'+record.result.seed+'.json')throw new Error('Unexpected seed record: '+file);
    records.push({source:'artifacts/'+BATCH+'/seeds/'+file,historical:false,result:record.result});
  }
  records.sort((a,b)=>a.result.seed-b.result.seed);
  if(new Set(records.map(r=>r.result.seed)).size!==records.length)throw new Error('Duplicate seed cannot count as an independent match.');
  return records;
}
export function report(manifest) {
  const records=collect(manifest), results=records.map(r=>r.result), completed=results.filter(r=>r.phase==='RESULT'), durations=completed.map(r=>r.battleSeconds).sort((a,b)=>a-b);
  const inTarget=durations.filter(s=>s>=600&&s<=780).length, missing=Array.from({length:40},(_,i)=>1001+i).filter(seed=>!results.some(r=>r.seed===seed));
  const violations=results.flatMap(r=>{
    const found=[]; if(r.negativeGold)found.push('negativeGold');if(r.activeHeroDuplicates)found.push('activeHeroDuplicates');
    if(r.metrics.invalidPositions!==0)found.push('invalidPositions');if(r.metrics.stalledEvents!==0)found.push('navigationStalls');if(r.botStalls.length)found.push('botStalls');
    if(r.metrics.tickCount!==Math.round(r.battleSeconds*20))found.push('fixedTickCount');
    if(r.metrics.wavesSpawned!==Math.floor(r.battleSeconds/20)+1||r.metrics.spawnedMinions!==r.metrics.wavesSpawned*28)found.push('minionWaveCount');
    if(r.phase==='RESULT'&&(r.awards?.length!==7||!r.metrics.destroyed.some(d=>d.kind==='NEXUS')))found.push('nexusResultAndAwards');
    return found.map(kind=>({seed:r.seed,kind}));
  });
  const firstTen=results.filter(r=>r.seed<=1010),firstTenTimes=firstTen.filter(r=>r.phase==='RESULT').map(r=>r.battleSeconds).sort((a,b)=>a-b),screenMedian=quantile(firstTenTimes,.5);
  const screen={recorded:firstTen.length,completed:firstTenTimes.length,inTarget:firstTenTimes.filter(s=>s>=600&&s<=780).length,median:screenMedian,status:firstTen.length<10?'INCOMPLETE':firstTenTimes.length===10&&firstTenTimes.filter(s=>s>=600&&s<=780).length>=7&&screenMedian>=600&&screenMedian<=780&&!violations.some(v=>v.seed<=1010)?'PASS':'FAIL'};
  const med=quantile(durations,.5),gate={exactly40Distinct:results.length===40&&missing.length===0,all40Completed:completed.length===40,atLeast28InTarget:inTarget>=28,median600To780:med!==null&&med>=600&&med<=780,noInvariantViolations:violations.length===0};
  const summary={status:missing.length?'INCOMPLETE':Object.values(gate).every(Boolean)?'PASS':'FAIL',manifestId:manifest.manifestId,matchesRecorded:results.length,completed:completed.length,inTarget,requiredInTarget:28,targetSeconds:[600,780],screen,below10Minutes:durations.filter(s=>s<600).length,after13Minutes:durations.filter(s=>s>780).length,unfinished:results.filter(r=>r.phase!=='RESULT').map(r=>r.seed),missingSeeds:missing,durationSeconds:distribution(durations),gate,invariantViolations:violations,metrics:{meanLivingUnits:distribution(results.map(r=>r.meanLivingUnits)),maxUnits:Math.max(0,...results.map(r=>r.maxUnits)),firstOuterDestroyedSeconds:distribution(results.map(r=>r.firstOuterDestroyedSeconds)),firstInnerDestroyedSeconds:distribution(results.map(r=>r.firstInnerDestroyedSeconds)),firstGuardDestroyedSeconds:distribution(results.map(r=>r.firstGuardDestroyedSeconds)),firstGuardApproachSeconds:distribution(results.map(r=>r.firstGuardApproachSeconds)),firstNexusDamageSeconds:distribution(results.map(r=>r.firstNexusDamageSeconds)),legendaryAcquisitions:distribution(results.map(r=>r.legendaryAcquisitions)),heroDeaths:distribution(results.map(r=>r.heroDeaths)),meanCompletedMaintenanceSeconds:distribution(results.map(r=>r.meanCompletedMaintenanceSeconds)),censoredUnfinishedMaintenanceCount:results.reduce((s,r)=>s+r.unfinishedMaintenanceCount,0),navigationStalls:results.reduce((s,r)=>s+r.metrics.stalledEvents,0),invalidPositions:results.reduce((s,r)=>s+r.metrics.invalidPositions,0),botStalls:results.reduce((s,r)=>s+r.botStalls.length,0)},performanceCaveat:'Fixed-tick acceleration. Parallel workers and historical machine contention affect tick/wall timings; this is not a normal-speed browser or school-device performance benchmark.',historicalEvidence:manifest.historicalEvidence};
  atomicJSON(resolve(DIRECTORY,'combined-results.json'),{manifest,records});atomicJSON(resolve(DIRECTORY,'summary.json'),summary);
  console.log(JSON.stringify({status:summary.status,recorded:results.length,completed:completed.length,inTarget,median:med,missing:missing.length,invariantViolations:violations.length}));return summary;
}
async function runStage(manifest,stage,workers) {
  const recorded=collect(manifest).map(r=>r.result);
  const first=stage==='screen'?(manifest.basePath?1005:1001):stage==='final'?1011:1001;
  const last=stage==='screen'?1010:1040;
  const required=Array.from({length:last-first+1},(_,i)=>first+i);
  // A screening failure is evidence, not authorization to omit the required40.
  // The caller explicitly chooses when to run the remaining or fresh full batch.
  const pending=required.filter(seed=>!recorded.some(r=>r.seed===seed));if(!pending.length){const summary=report(manifest);if(stage==='screen'&&summary.screen.status==='FAIL'||(stage==='final'||stage==='all')&&summary.status!=='PASS')process.exitCode=1;return;}
  const chunks=Array.from({length:Math.min(workers,pending.length)},()=>[]);pending.forEach((seed,i)=>chunks[i%chunks.length].push(seed));
  const children=[];const stop=()=>{for(const child of children)child.kill('SIGTERM');};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{await Promise.all(chunks.map((seeds,index)=>new Promise((resolveWorker,reject)=>{
    const logPath=resolve(DIRECTORY,stage+'-worker'+(index+1)+'.log'),fd=openSync(logPath,'a');
    const child=spawn(process.execPath,[resolve(ROOT,'node_modules/tsx/dist/cli.mjs'),resolve(ROOT,'scripts/soak-final-worker.mjs'),seeds.join(',')],{cwd:ROOT,env:{...process.env,SOAK_BATCH:BATCH,SIM_PROGRESS:'1'},stdio:['ignore',fd,fd],windowsHide:true});children.push(child);closeSync(fd);
    console.log(JSON.stringify({stage,worker:index+1,pid:child.pid,seeds,logPath}));
    child.on('error',reject);child.on('close',(code,signal)=>{report(manifest);code===0?resolveWorker():reject(new Error('Worker '+(index+1)+' stopped: code='+code+', signal='+signal+'. Completed seed files were preserved.'));});
  })));}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
  const summary=report(manifest);if(stage==='screen'&&summary.screen.status==='FAIL'||(stage==='final'||stage==='all')&&summary.status!=='PASS')process.exitCode=1;
}
async function main(){
  const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const m=/^--(stage|workers|batch|fresh)=(.+)$/.exec(arg);if(!m)throw new Error('Use --stage=prepare|report|screen|final|all and optional --workers=1..3 --batch=plain-name --fresh=1');return [m[1],m[2]];}));
  const stage=args.stage||'report',workers=Number(args.workers||(stage==='screen'?2:3));if(!['prepare','report','screen','final','all'].includes(stage)||!Number.isInteger(workers)||workers<1||workers>3)throw new Error('Invalid stage/workers.');
  const manifest=stage==='prepare'?prepare():loadManifest(stage!=='report');if(stage==='prepare'||stage==='report'){const summary=report(manifest);if(stage==='report'&&summary.status==='FAIL')process.exitCode=1;return;}await runStage(manifest,stage,workers);
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(error=>{console.error(error);process.exitCode=1;});
