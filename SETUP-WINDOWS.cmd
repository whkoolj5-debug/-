@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo RSF POKER 2.1 - 처음 설치 및 명령어 등록
where node >nul 2>nul
if errorlevel 1 goto no_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto no_node
call npm ci
if errorlevel 1 goto failed
if not exist ".env" copy /y ".env.example" ".env" >nul
echo.
echo 메모장에서 DISCORD_TOKEN, CLIENT_ID, GUILD_ID를 입력하고 저장하세요.
echo 토큰은 채팅이나 GitHub에 올리지 마세요. 나머지는 기본 설정을 유지하세요.
start "" notepad "%~dp0.env"
echo 저장을 마친 뒤 이 창으로 돌아와 아무 키나 누르세요.
pause >nul
call npm run check
if errorlevel 1 goto failed
call npm run register
if errorlevel 1 goto failed
echo.
echo 준비 완료! START-BOT.cmd를 더블클릭하면 봇이 켜집니다.
pause
exit /b 0
:no_node
echo Node.js 24 이상을 설치하고 이 파일을 다시 실행하세요.
pause
exit /b 1
:failed
echo 위 오류 내용을 확인하세요. 토큰이 보이면 공유하지 마세요.
pause
exit /b 1
