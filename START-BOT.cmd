@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist ".env" goto setup
if not exist "node_modules" goto setup
echo RSF POKER - Ready 로그가 나오면 디스코드에서 사용할 수 있습니다.
echo 이 창을 닫거나 PC를 끄면 봇도 꺼집니다. 종료는 Ctrl+C입니다.
node src/index.js
echo 봇이 종료되었습니다.
pause
exit /b
:setup
echo 먼저 SETUP-WINDOWS.cmd를 실행하세요.
pause
exit /b 1
