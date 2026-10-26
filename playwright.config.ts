import { defineConfig } from '@playwright/test';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const hardwareGpu=process.env.CLASH_TEST_GPU==='d3d11';
const runDirectory=join(tmpdir(),`classclash-browser-${Date.now()}`);
mkdirSync(runDirectory,{recursive:true});mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/e2e-run-location.json',JSON.stringify({runDirectory,reason:'Keep SQLite WAL and active browser recording outside cloud-synced source folders; final screenshots/reports remain in artifacts.'},null,2));
export default defineConfig({
  testDir:'tests/e2e',testIgnore:'**/visual-performance.spec.ts',timeout:240000,workers:1,fullyParallel:false,
  outputDir:join(runDirectory,'browser-results'),
  expect:{timeout:15000},reporter:[['list'],['html',{open:'never'}]],
  use:{launchOptions:hardwareGpu?{args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']}:{},baseURL:'http://127.0.0.1:3101',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
  webServer:{command:'node dist/server.js',url:'http://127.0.0.1:3101/api/health',reuseExistingServer:false,timeout:120000,env:{PORT:'3101',DATABASE_PATH:join(runDirectory,'state.sqlite'),NODE_ENV:'test',CLASH_TEST_SPEED:'4'}},
});
