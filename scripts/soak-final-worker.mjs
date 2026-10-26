import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { setupBots, runMatch } from './simulate.ts';
import BALANCE from '../src/shared/balance.ts';
import { ROOT, atomicJSON, canonical, loadManifest, seedPath, readJSON } from './soak-final.mjs';
const manifest=loadManifest();
const runtime={structureStats:BALANCE.structureStats,minimumDeadWaitSeconds:BALANCE.deployment.minimumDeadWaitSeconds,structureDamagePhases:BALANCE.minions.structureDamagePhases};
if(canonical(runtime)!==canonical(manifest.balance))throw new Error('Runtime balance differs from preserved candidate9. No match started.');
const seeds=(process.argv[2]||'').split(',').map(Number);
if(!seeds.length||seeds.some(seed=>!Number.isInteger(seed)||seed<(manifest.basePath?1005:1001)||seed>1040)||new Set(seeds).size!==seeds.length)throw new Error('Invalid unique continuation seeds.');
for(const seed of seeds){
  loadManifest();
  if(existsSync(seedPath(seed))){const previous=readJSON(seedPath(seed));if(previous.manifestId!==manifest.manifestId)throw new Error('Existing seed has another manifest.');console.log('Preserved completed record for seed '+seed);continue;}
  if(existsSync(resolve(ROOT,'artifacts/soak.pause')))console.log('Paused between matches; remove artifacts/soak.pause to resume.');
  while(existsSync(resolve(ROOT,'artifacts/soak.pause')))await new Promise(resolveWait=>setTimeout(resolveWait,1000));
  loadManifest();
  const result=runMatch(setupBots(seed),manifest.matchLimitSeconds);
  loadManifest();
  atomicJSON(seedPath(seed),{manifestId:manifest.manifestId,recordedAt:new Date().toISOString(),result});
  console.log(JSON.stringify({seed,phase:result.phase,battleSeconds:result.battleSeconds,wallSeconds:result.wallSeconds,navStalls:result.metrics.stalledEvents,meanLivingUnits:result.meanLivingUnits}));
}
