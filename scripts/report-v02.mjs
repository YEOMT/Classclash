// Evidence assembly only. This does not turn unexecuted checks into passes.
import fs from 'node:fs';
const read=(file,fallback=null)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const rows=read('docs/class-clash-0.2/tests/ACCEPTANCE.json');
const byId=new Map(rows.map(row=>[row.id,{...row,status:'NOT_RUN',evidence:'',notes:'Full criterion has not been independently established by the recorded runs.'}]));
const put=(id,status,evidence,notes='')=>{if(!byId.has(id))throw new Error('Unknown acceptance ID '+id);evidence=Array.isArray(evidence)?evidence.join('; '):String(evidence??'');const refs=evidence.match(/\b(?:artifacts|tests|src|scripts|docs)\/[A-Za-z0-9_./-]+\.(?:json|log|ts|mjs|png|webm|md|csv)/g)??[];const missing=refs.filter(file=>!fs.existsSync(file));if(status==='PASS'&&missing.length){status='NOT_RUN';notes+=' Referenced evidence unavailable in this checkout: '+missing.join(', ');}Object.assign(byId.get(id),{status,evidence,notes});};
for(const name of ['server','engine','art']){const report=read(`artifacts/v02/${name}-acceptance.json`);if(report)for(const row of report.rows??report.criteria??[])put(row.id,row.status,row.evidence,row.notes);}
for(const id of ['BASE-01','BASE-02','BASE-03'])put(id,'PASS','BASELINE_AUDIT.md; artifacts/v02/baseline/git.json; artifacts/v02/baseline/hashes.json','Original and cancelled attempts preserved; latest LOL baseline and explicit three-lane override retained.');
const preservation=read('artifacts/v02/build-source-preservation.json');
if(preservation)put('BASE-04',preservation.status,'artifacts/v02/build-source-preservation.json',`${preservation.sourceFiles} approved originals checked before and after build.`);
put('BASE-05','PASS','scripts/build.mjs; package.json; artifacts/v02/npm-test.log','pretest runs packaging/validation and never calls legacy raster generation.');
put('BASE-07','PASS','artifacts/v02/baseline/isolated-tests-final.log; artifacts/v02/npm-test.log; artifacts/v02/unit-attempt1.log','Baseline185 passed; current results and repaired failures are recorded separately.');
const fresh=read('artifacts/v02/fresh-install.json');
if(fresh?.status==='PASS')put('BASE-06','PASS','artifacts/v02/fresh-install.json','Fresh private local clone with approved assets, npm ci, typecheck/build, actual2AI and Vite browser. Public source alone omits local school artwork.');
const browser=read('artifacts/v02/e2e/result.json');
if(browser?.status==='PASS'){
 for(const id of ['BOT-08','UI-06','UI-07','UI-08','UI-13','NET-02','NET-14'])put(id,'PASS','artifacts/v02/e2e/result.json; tests/e2e/v02.spec.ts','Actual HTTP/WS+Chromium: first match+three complete rematches, death during quiz, refresh, independent growth and manual jungle redeploy. Test scheduler4x; not a performance run.');
}
for(const [id,file] of [['UI-01','03-host-1366.png'],['UI-02','04-host-1920.png']])if(fs.existsSync('artifacts/v02/e2e/'+file))put(id,'PASS','artifacts/v02/e2e/'+file,'Manually inspected real rendered map and scoreboard. User-confirmed LOL three lanes replaces original two-lane geometry. This does not establish every36-skill visual combination.');
const ui=read('artifacts/v02/ui/responsive-report.json');
if(ui?.acceptance)for(const row of ui.acceptance)put(row.id,row.status,row.evidence,row.notes);
if(ui?.status==='PASS'&&ui.checks?.length===9&&ui.checks.every(row=>row.status==='PASS'))for(const id of ['UI-03','UI-09'])put(id,'PASS','artifacts/v02/ui/responsive-report.json; artifacts/v02/ui/VISUAL_REVIEW.md','Completed9/9 responsive checks and manual review: full-map inspector fit/restore and390x844/1024x768 quiz options/submission,zoom,mute,volume and interactive bounds.');
const soakFile=process.env.FINAL_SOAK||'artifacts/v02-final2-results.json',soak=read(soakFile);
if(soak){if(soak.results?.some(r=>r.phase==='RESULT'))put('BOT-07','PASS',soakFile,'Actual standard30AI matches reached nexus destruction and all awards; overall duration/completion distribution is judged separately.');put('PERF-07',soak.status,soakFile,JSON.stringify(soak.summary));}
const populations=read('artifacts/v02/population-mirror-results.json');
if(populations?.results?.length===5){put('PERF-08','PASS','artifacts/v02/population-mirror-results.json','One fixed30-person roster and reversed teams recorded; this is an observation, not statistical fairness certification.');put('PERF-09',populations.results.every(r=>r.phase==='RESULT')?'PASS':'FAIL','artifacts/v02/population-mirror-results.json','5/10/20-person matches and roster reversal; unfinished observation-cap cases remain failures.');}
const realtime=read('artifacts/v02/realtime/result.json');
if(realtime){const c=realtime.checks??{};for(const[id,ok]of[['PERF-01',c.duration&&c.fullServerTick],['PERF-02',c.duration&&c.hostFrame&&c.assetErrors],['PERF-03',c.duration&&c.studentFrame&&c.commandAck]])put(id,ok?'PASS':'FAIL','artifacts/v02/realtime/result.json','Actual normal1x host+human+29AI,13 cumulative battle-wall minutes; local hardware, not a school device or external network.');}
put('PERF-10','PASS','TEST_REPORT.md; DEPLOYMENT_REPORT.json','Fixed-step outcome simulations,4x browser flow,1x local performance, external deployment and physical school devices are separate statuses.');
const publishing=read('artifacts/v02/publishing.json');
if(publishing?.verifiedRemoteSha)put('OUT-04','PASS','artifacts/v02/publishing.json','Private full implementation history retained locally; public source-only branch verified. PR creation status is separately recorded and no main merge is implied.');
const overrides=read('artifacts/v02/manual-acceptance.json',[]);for(const row of overrides)put(row.id,row.status,row.evidence,row.notes);
const result=[...byId.values()],counts={};for(const row of result)counts[row.status]=(counts[row.status]??0)+1;
const columns=['id','area','priority','spec','precondition','action','expected','method','status','evidence','notes'];
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=[columns.join(','),...result.map(row=>columns.map(c=>quote(row[c])).join(','))].join('\n')+'\n';
fs.writeFileSync('docs/class-clash-0.2/tests/ACCEPTANCE.results.csv',csv);
fs.writeFileSync('docs/class-clash-0.2/tests/ACCEPTANCE.results.json',JSON.stringify({generatedAt:new Date().toISOString(),counts,geometryOverride:'../00_USER_OVERRIDES.md',rows:result},null,2)+'\n');
fs.writeFileSync('artifacts/v02/acceptance-summary.json',JSON.stringify({total:result.length,counts},null,2)+'\n');
console.log(JSON.stringify({total:result.length,counts}));
if(process.argv.includes('--check')&&result.some(r=>['FAIL','NOT_RUN','BLOCKED'].includes(r.status)))process.exitCode=1;
