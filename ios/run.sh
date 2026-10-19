#!/usr/bin/env bash
# ==============================================================================
# SpeakFlow iOS · MacBook 一键极简编译脚本 (针对 iPhone 15 Pro 定制)
# 使用方式：在 Mac 终端中进入 ios 目录，执行: ./run.sh
# ==============================================================================

set -e

echo "🚀 [SpeakFlow] 正在为 iPhone 15 Pro 准备 Xcode 工程..."

# 进入脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. 检查 Xcode 命令行工具
if ! xcode-select -p &>/dev/null; then
    echo "⚠️ 未检测到 Xcode 命令行工具，正在唤起安装..."
    xcode-select --install
    echo "请在弹窗完成安装后重新运行此脚本。"
    exit 1
fi

# 2. 检查并安装 xcodegen
if ! command -v xcodegen &>/dev/null; then
    echo "📦 未检测到 xcodegen，正在尝试通过 Homebrew 自动安装..."
    if command -v brew &>/dev/null; then
        brew install xcodegen
    else
        echo "❌ 未检测到 Homebrew。请在终端执行安装 Homebrew 后重试："
        echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        exit 1
    fi
fi

# 3. 重新生成干净的 Xcode 工程
echo "⚙️ 正在生成最新 Xcode 工程 (SpeakFlow.xcodeproj)..."
xcodegen generate

# 4. 打开 Xcode
if [ -d "SpeakFlow.xcodeproj" ]; then
    echo "✨ Xcode 工程已成功生成！正在为您打开..."
    open SpeakFlow.xcodeproj
    
    echo ""
    echo "=================================================================="
    echo "📱 MacBook 上只需两步即可在 iPhone 15 Pro 上安装运行："
    echo "=================================================================="
    echo " 1. 在 Xcode 左侧点击根节点 'SpeakFlow' -> 'Signing & Capabilities'："
    echo "    - Team 下拉框选择您的免费个人 Apple ID (Personal Team)。"
    echo ""
    echo " 2. 在 Xcode 顶部设备栏选择连接的 'iPhone 15 Pro'："
    echo "    - 直接按键盘快捷键 [ ⌘ + R ] 一键编译安装！"
    echo ""
    echo " 🎉 首次安装到手机后：进入 iPhone [设置] -> [通用] -> [VPN与设备管理] 信任即可。"
    echo "=================================================================="
else
    echo "❌ 工程生成失败，请检查 project.yml 配置。"
    exit 1
fi
