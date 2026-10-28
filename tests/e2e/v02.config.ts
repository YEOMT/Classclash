import {defineConfig} from '@playwright/test';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
export default defineConfig({testDir:'.',testMatch:'v02.spec.ts',timeout:1800000,workers:1,reporter:'list',outputDir:'../../artifacts/v02/browser',use:{baseURL:'http://127.0.0.1:3128',launchOptions:{args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']},screenshot:'only-on-failure'},expect:{timeout:25000},webServer:{cwd:resolve('.'),command:'node dist/server.js',url:'http://127.0.0.1:3128/api/health',reuseExistingServer:false,timeout:120000,env:{PORT:'3128',DATABASE_PATH:join(tmpdir(),`classclash-v02-e2e-${Date.now()}.sqlite`),NODE_ENV:'test',CLASH_TEST_SPEED:'4'}}});
