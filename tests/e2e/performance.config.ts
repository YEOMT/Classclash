import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export default defineConfig({
 testDir:'.',testMatch:'visual-performance.spec.ts',timeout:540000,workers:1,reporter:'list',
 use:{baseURL:'http://127.0.0.1:3000',trace:'off',...(process.env.CLASH_TEST_GPU==='d3d11'?{launchOptions:{args:['--use-gl=angle','--use-angle=d3d11'],ignoreDefaultArgs:['--enable-unsafe-swiftshader']}}:{})},outputDir:'../../artifacts/performance-test-results',
 webServer:{command:'node dist/server.js',cwd:fileURLToPath(new URL('../../',import.meta.url)),url:'http://127.0.0.1:3000/api/health',reuseExistingServer:false,timeout:120000,env:{PORT:'3000',DATABASE_PATH:join(tmpdir(),`class-clash-render-perf-${Date.now()}.sqlite`),CLASH_TEST_SPEED:'1'}},
});
