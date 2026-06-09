@echo off
REM ============================================================
REM  SpeakFlow 部署脚本
REM  作用:杀旧进程 -> 构建前端 -> 启动后端 -> 启动 cloudflared
REM  使用:双击 deploy.bat
REM  关闭:双击 stop.bat
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_LOG=%ROOT%backend.log"
set "TUNNEL_LOG=%ROOT%tunnel.log"
set "PORT=3001"

echo.
echo ============================================================
echo   SpeakFlow 部署
echo ============================================================

REM ---------- 前置检查 ----------
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 node,请先安装 Node.js 18+
    echo        下载:https://nodejs.org/
    pause
    exit /b 1
)
echo [环境] node:& for /f "delims=" %%v in ('node -v') do echo        %%v

REM ---------- 1. 清理旧进程 ----------
echo.
echo [1/4] 清理 3001 端口上的旧 node 进程...
set "KILLED=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo        杀掉 PID %%p
    taskkill /F /PID %%p >nul 2>&1
    set "KILLED=1"
)
if "!KILLED!"=="0" echo        端口 %PORT% 空闲

REM 兜底:按窗口标题杀残留
taskkill /F /FI "WINDOWTITLE eq SpeakFlow-Backend*" >nul 2>&1

REM ---------- 2. 构建 frontend ----------
echo.
echo [2/4] 检查/构建前端...
if not exist "%FRONTEND_DIR%\node_modules" (
    echo        第一次运行,安装前端依赖...
    pushd "%FRONTEND_DIR%" && call npm install
    if errorlevel 1 ( popd & echo [错误] npm install 失败 & pause & exit /b 1 )
    popd
)
if not exist "%FRONTEND_DIR%\dist\index.html" (
    echo        构建前端(可能 1-2 分钟)...
    pushd "%FRONTEND_DIR%" && call npm run build
    if errorlevel 1 ( popd & echo [错误] 前端构建失败 & pause & exit /b 1 )
    popd
) else (
    echo        dist/index.html 已存在,跳过构建
)

REM ---------- 3. 启动后端 ----------
echo.
echo [3/4] 启动后端(serve dist + API + WebSocket)...
if not exist "%BACKEND_DIR%\node_modules" (
    echo        安装后端依赖...
    pushd "%BACKEND_DIR%" && call npm install
    if errorlevel 1 ( popd & echo [错误] 后端 npm install 失败 & pause & exit /b 1 )
    popd
)
if not exist "%BACKEND_DIR%\.env" (
    copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
    echo        [警告] 已生成 .env,请填入你的 MINIMAX_API_KEY
)

if exist "%BACKEND_LOG%" del "%BACKEND_LOG%"
if exist "%TUNNEL_LOG%" del "%TUNNEL_LOG%"

REM 后台启动,日志写到 backend.log
start "SpeakFlow-Backend" /MIN cmd /c "cd /d %BACKEND_DIR% && npm run dev > %BACKEND_LOG% 2>&1"

echo        等待后端监听 %PORT% ...
:wait_backend
timeout /t 2 /nobreak >nul
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul
if errorlevel 1 goto wait_backend
echo        后端已就绪

REM ---------- 4. cloudflared 隧道 ----------
echo.
echo [4/4] 启动公网隧道...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo        [跳过] 未检测到 cloudflared,仅本地可用
    echo               下载:https://github.com/cloudflare/cloudflared/releases
    echo.
    echo ============================================================
    echo   部署完成(仅本地)
    echo   访问:http://localhost:%PORT%
    echo   关闭:双击 stop.bat
    echo ============================================================
    echo.
    pause
    exit /b 0
)

start "SpeakFlow-Tunnel" /MIN cmd /c "cloudflared tunnel --url http://localhost:%PORT% > %TUNNEL_LOG% 2>&1"

echo        等待 cloudflared 输出 URL(约 8-15 秒)...
:wait_url
timeout /t 3 /nobreak >nul
findstr /R "trycloudflare.com" "%TUNNEL_LOG%" >nul 2>&1
if errorlevel 1 goto wait_url

REM 提取公网 URL(取第一个匹配,去掉首尾空格)
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
echo   注意:临时隧道 URL 每次重启都会变
echo   关闭:双击 stop.bat
echo ============================================================
echo.
echo 日志文件:%BACKEND_LOG%  /  %TUNNEL_LOG%
echo.
pause
endlocal
