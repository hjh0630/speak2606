@echo off
REM ============================================================
REM  SpeakFlow 停止脚本
REM  作用:杀掉 node(3001) + cloudflared
REM  使用:双击 stop.bat
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion

set "ROOT=%~dp0"
set "PORT=3001"

echo.
echo ============================================================
echo   SpeakFlow 停止
echo ============================================================

REM 1. 杀 3001 端口上的进程
echo.
echo [1/3] 关闭 3001 端口上的后端进程...
set "KILLED=0"
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    echo        杀掉 PID %%p
    taskkill /F /PID %%p >nul 2>&1
    set "KILLED=1"
)
if "!KILLED!"=="0" echo        端口 %PORT% 空闲

REM 2. 按窗口标题兜底杀
echo [2/3] 关闭 SpeakFlow 相关窗口...
taskkill /F /FI "WINDOWTITLE eq SpeakFlow-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq SpeakFlow-Tunnel*" >nul 2>&1

REM 3. 杀 cloudflared
echo [3/3] 关闭 cloudflared 隧道...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo.
echo 已清理完毕。
echo.
timeout /t 2 /nobreak >nul
endlocal
