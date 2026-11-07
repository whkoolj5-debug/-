@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules" call npm ci
if errorlevel 1 goto failed
call npm run preview
if errorlevel 1 goto failed
start "" explorer "%~dp0work\preview"
echo 생성된 사진은 데모 게임입니다. 실제 Discord 연결이나 토큰이 필요 없습니다.
pause
exit /b 0
:failed
echo 오류를 확인하세요. Node.js 24 이상이 필요합니다.
pause
exit /b 1
