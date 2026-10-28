// Public source CI deliberately does not claim validation of the local-only art pack.
import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const excluded=new Set(['content.test.ts','hero-assets.test.ts','jungle.test.ts','server.test.ts','production-security.test.ts','v02-art-contract.test.ts','world-assets.test.ts']);
const files=readdirSync('tests').filter(f=>f.endsWith('.test.ts')&&!excluded.has(f)).map(f=>'tests/'+f);
console.log('Source-only suite. Full build, artwork, browser and production integration require the local approved asset pack.');
console.log('Excluded asset/runtime suites: '+[...excluded].join(', '));
const result=spawnSync(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;process.exitCode=result.status??1;
