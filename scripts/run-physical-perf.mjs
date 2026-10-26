import{spawn}from'node:child_process';
const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','tests/e2e/performance.config.ts'],{windowsHide:true,stdio:'inherit',env:{...process.env,CLASH_TEST_GPU:'d3d11'}});
child.on('exit',code=>{process.exitCode=code??1;});child.on('error',error=>{console.error(error);process.exitCode=1;});
