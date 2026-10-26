@echo off
setlocal
cd /d "%~dp0"
set "CLASH_NODE_DIR=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if exist "%CLASH_NODE_DIR%\node.exe" set "PATH=%CLASH_NODE_DIR%;%PATH%"
where node >nul 2>&1
if errorlevel 1 (
  echo Please install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
if exist ".tools\package\bin\npm-cli.js" (
  set "CLASH_NPM=node .tools\package\bin\npm-cli.js"
) else (
  set "CLASH_NPM=npm"
)
if not exist "node_modules\pixi.js\package.json" (
  call %CLASH_NPM% ci
  if errorlevel 1 exit /b 1
)
call %CLASH_NPM% run build
if errorlevel 1 exit /b 1
echo.
echo Class Clash: http://127.0.0.1:3000
echo Keep this window open. Press Ctrl+C to stop the server.
node dist\server.js
if errorlevel 1 pause
