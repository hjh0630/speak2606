@echo off
chcp 65001 >nul
echo ================================
echo   SpeakFlow 本地启动脚本
echo ================================

REM 检查 Node
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js,请先安装 Node 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

node -v
npm -v

REM 进入 content 目录
cd /d %~dp0content

REM 检查依赖
if not exist node_modules (
    echo [信息] 第一次运行,安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

REM 检查 .env
if not exist .env (
    echo [信息] 未发现 .env,复制 .env.example...
    copy .env.example .env
    echo [警告] 请先编辑 .env 填入你的 MINIMAX_API_KEY
    pause
)

REM 启动
echo.
echo [启动] http://localhost:3001
echo [提示] Ctrl+C 停止
echo.
call npm run dev
