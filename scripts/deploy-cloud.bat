@echo off
REM ============================================================
REM  SpeakFlow 云端部署 (Windows)
REM  适用:在非隔离网络(家宽/4G/办公网)运行,自动:
REM    1) 杀 3001 旧进程
REM    2) 启动后端 (serve dist + API + SPA)
REM    3) 启动 cloudflared 隧道
REM    4) 输出公网 URL
REM  关闭:stop.bat
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%..\backend"
set "BACKEND_LOG=%ROOT%..\backend.log"
set "TUNNEL_LOG=%ROOT%..\tunnel.log"
set "CONTENT_DIR=%ROOT%..\content"
set "PORT=3001"

echo.
echo ============================================================
echo   SpeakFlow 云端部署
echo   内容语料:%CONTENT_DIR%
echo   纺织服装英语模块:content\textile-english\
echo ============================================================

REM ---------- 1. 清理旧进程 ----------
echo.
echo [1/4] 清理 %PORT% 端口旧进程...
set "KILLED=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo        杀掉 PID %%p
    taskkill /F /PID %%p >nul 2>&1
    set "KILLED=1"
)
if "!KILLED!"=="0" echo        端口 %PORT% 空闲

REM ---------- 2. 启动后端 ----------
echo.
echo [2/4] 启动后端(serve dist + API + WebSocket + SPA)...
if not exist "%BACKEND_DIR%\dist\src\index.js" (
    echo        [警告] backend/dist/src/index.js 不存在,先构建:
    echo        cd %BACKEND_DIR% ^&^& npm run build
    pause
    exit /b 1
)

if exist "%BACKEND_LOG%" del "%BACKEND_LOG%"
if exist "%TUNNEL_LOG%" del "%TUNNEL_LOG%"

set "CONTENT_DIR=%CONTENT_DIR%"
start "SpeakFlow-Backend" /MIN cmd /c "set CONTENT_DIR=%CONTENT_DIR%&& cd /d %BACKEND_DIR%\dist\src && node index.js > %BACKEND_LOG% 2>&1"

echo        等待后端监听 %PORT% ...
:wait_backend
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if errorlevel 1 goto wait_backend
echo        后端已就绪

REM ---------- 3. 后端 smoke ----------
echo.
echo [3/4] 后端 smoke 测试...
curl -s http://localhost:%PORT%/api/status >nul
if errorlevel 1 (
    echo        [警告] /api/status 失败,查看 %BACKEND_LOG%
) else (
    echo        /api/status OK
)

REM ---------- 4. cloudflared 隧道 ----------
echo.
echo [4/4] 启动公网隧道(cloudflared)...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo        [跳过] 未检测到 cloudflared
    echo               下载:https://github.com/cloudflare/cloudflared/releases
    echo               安装到:C:\Users\%USERNAME%\cloudflared\
    echo.
    echo ============================================================
    echo   本地就绪
    echo   访问:http://localhost:%PORT%
    echo ============================================================
    pause
    exit /b 0
)

start "SpeakFlow-Tunnel" /MIN cmd /c "cloudflared tunnel --url http://localhost:%PORT% > %TUNNEL_LOG% 2>&1"

echo        等待 cloudflared 输出 URL(约 8-30 秒)...
:wait_url
timeout /t 3 /nobreak >nul
findstr /R "trycloudflare.com" "%TUNNEL_LOG%" >nul 2>&1
if errorlevel 1 goto wait_url

set "URL="
for /f "tokens=2 delims=|" %%a in ('findstr /R "trycloudflare.com" "%TUNNEL_LOG%"') do (
    if "!URL!"=="" (
        set "RAW=%%a"
        for /f "tokens=*" %%b in ("!RAW!") do set "URL=%%b"
    )
)

echo.
echo ============================================================
echo   部署完成
echo   本地:http://localhost:%PORT%
echo   公网:!URL!
echo.
echo   校验 (在新 shell):
echo     curl !URL!/api/status
echo     curl !URL!/api/scenarios ^| head -c 200
echo.
echo   注意:临时隧道 URL 每次重启都会变
echo   关闭:stop.bat
echo ============================================================
echo 日志:%BACKEND_LOG%  /  %TUNNEL_LOG%
echo.
pause
endlocal
