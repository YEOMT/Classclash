import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e',timeout:240000,workers:1,fullyParallel:false,
  expect:{timeout:15000},reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:3101',viewport:{width:1366,height:768},trace:'retain-on-failure',screenshot:'only-on-failure',video:'on'},
  webServer:{command:'node --import tsx src/server/index.ts',url:'http://127.0.0.1:3101/api/health',reuseExistingServer:false,timeout:30000,env:{PORT:'3101',DATABASE_PATH:`data/e2e-${Date.now()}.sqlite`,NODE_ENV:'test',CLASH_TEST_SPEED:'12'}},
});
