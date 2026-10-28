import {defineConfig} from '@playwright/test';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
export default defineConfig({testDir:'.',testMatch:'jungle.spec.ts',timeout:1200000,workers:1,reporter:'list',outputDir:'../../artifacts/jungle-rework/browser',use:{baseURL:'http://127.0.0.1:3102',viewport:{width:1440,height:1000},launchOptions:{args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']},screenshot:'only-on-failure'},expect:{timeout:20000},webServer:{cwd:resolve('.'),command:'node dist/server.js',url:'http://127.0.0.1:3102/api/health',reuseExistingServer:false,timeout:120000,env:{PORT:'3102',DATABASE_PATH:join(tmpdir(),`classclash-jungle-${Date.now()}.sqlite`),NODE_ENV:'test',CLASH_TEST_SPEED:'4'}}});
