# 🍎 SpeakFlow (HTalk) · MacBook 极简编译与运行指南

> **目标**：在你的 MacBook 上，将最新的 **SpeakFlow (iPhone 15 Pro 深度优化版 + 信泰纺织前沿实战 8 大场景)** 极简编译并安装到真机 iPhone 15 Pro 上。全程无需付费苹果开发者账号（免费 Apple ID 即可）。

---

## ⚡ 极简 3 步上手（最快仅需 2 分钟）

### 第 1 步：在 MacBook 上获取最新代码

打开 Mac 上的「终端」（Terminal），执行：

```bash
# 如果尚未克隆仓库：
git clone https://github.com/hjh0630/speak2606.git SpeakFlow
cd SpeakFlow

# 如果已经克隆过，拉取最新提交：
git pull origin main
```

---

### 第 2 步：一键生成并打开 Xcode 工程

在 Mac 终端中直接运行配套好的极简脚本：

```bash
cd ios
chmod +x run.sh
./run.sh
```

> **脚本会自动执行**：
> 1. 检测 Mac 是否已具备 Xcode 与命令行工具；
> 2. 自动检查或通过 Homebrew 安装 `xcodegen`；
> 3. 基于 `project.yml` 重新生成最新的 `SpeakFlow.xcodeproj`；
> 4. 自动唤起 Xcode 打开工程。
> 
> *（提示：如果你不想使用终端脚本，直接双击打开 `ios/SpeakFlow.xcodeproj` 也可以！）*

---

### 第 3 步：Xcode 签名与一键真机运行 (⌘ + R)

Xcode 打开后，仅需配置一次个人签名：

1. **设置个人免费签名**：
   - 在 Xcode 左侧导航栏点击最顶部的蓝色工程图标 **`SpeakFlow`**。
   - 在中间区域选择 **`Signing & Capabilities`** 选项卡。
   - 勾选 **`Automatically manage signing`**。
   - 在 **`Team`** 下拉菜单中，选择你的个人免费 Apple ID（即 **Personal Team**）。
     *(如果下拉列表为空，点击 `Add Account...` 登录你的 Apple ID 即可，免费无需 $99/年开发者账号)*。
   - *（可选）如果提示 Bundle Identifier 冲突，可将 `Bundle Identifier` 改为 `com.你的英文名.speakflow`。*

2. **连接 iPhone 15 Pro 并安装**：
   - 用 Type-C 数据线将 iPhone 15 Pro 连接到 MacBook（手机屏幕提示「信任此电脑」时点击信任并输入手机密码）。
   - 在 Xcode 顶部正中间的设备下拉菜单中，选择你的 **iPhone 15 Pro**（而不是模拟器）。
   - 直接按键盘快捷键 **`⌘ + R`**（或者点击左上角三角形 ▶ 运行按钮）。
   - Xcode 将自动编译、安装并启动 App！

3. **手机端首次信任**（仅首次安装需要）：
   - 首次安装后点击 App 若提示「不受信任的开发者」，进入 iPhone 手机：
   - **`设置`** -> **`通用`** -> **`VPN 与设备管理`** -> 找到你的 Apple ID -> 点击 **`信任`**。
   - 返回手机主屏幕，即可顺畅打开 SpeakFlow！

---

## 🌟 iPhone 15 Pro 专属特色与实战功能

此版本已针对 iPhone 15 Pro 进行了全方位软硬件级定制：

1. **iPhone 15 Pro 专属视口与单手操作 Dock**：
   - 精确适配 393 × 852 pt 分辨率，避开 59pt 灵动岛 (Dynamic Island) 与底部 34pt Home 条；
   - 底部悬浮操控岛 (`.ultraThinMaterial` 毛玻璃质感)，74pt 超大触控麦克风按钮位于拇指黄金热区；
   - 深度集成 Taptic Engine 触觉震动反馈 (`UIImpactFeedbackGenerator`)，录音与评分具备细腻机械感。

2. **【💡 Native Polish 母语地道重述】引擎**：
   - 每次对话练习，AI 实时根据你的表述给出地道纺织母语重述（Native Polish Phrasing）；
   - 一键 TTS 发音跟读，支持原句与地道句对比复读，专为 1 个月建立母语直觉打造。

3. **信泰前沿实战 8 大场景（离线/在线完全内置）**：
   所有场景数据已完全打包至手机本地 `SpeakFlowKit` 中，断网离线也能随时随地练习：
   - 🏢 **五里智能展厅 (wuli_showroom)**：接待全球品牌高管，介绍 5G 智能工厂、10 大产业园区、年产 6 亿码宏大叙事；
   - 🤖 **Figure AI 具身人形机器人外皮 (figure_robot_skin)**：加州最新 PFAS-free DWR (<100ppm)、>150% 全向弹力、UHMWPE 防割高强工程谈判；
   - ⚙️ **圆编针织 32针/36针超细超密 (circular_knitting_as32)**：AS32/AX36 系列高针高密抗勾丝、透气与裸感四面弹力面料开发；
   - 🧵 **高性能纱线与复合纺 (yarn_high_tenacity)**：高强锦纶66、生物基碳中和纱线、差异化包覆纱；
   - 🪡 **飞织/电脑横机一体成型鞋面 (flyknit_flat_knitting)**：24G 电脑横机局部提花、一体飞织无缝鞋面开发；
   - 📐 **经编 3D 空气网布与双针床 (twone_warp_knitting)**：TWONE 28G/32G 双针床经编网眼、跑鞋支撑结构；
   - 💨 **喷气/剑杆超薄梭织抗撕裂 (woven_airjet_ripstop)**：20D/40D Cordura Ripstop 梭织防撕裂与耐磨面料；
   - 🎨 **数码印染与色差控制 (dyeing_delta_e)**：Delta E < 0.8、D65/TL84 双光源同色异谱测试及环保低水耗染整工艺。

---

## 🛠 常见排查与问答 (FAQ)

### Q1: 运行 `./run.sh` 提示没有 Homebrew 怎么办？
> 如果你的 Mac 尚未安装 Homebrew，可以在终端执行官方安装命令：
> ```bash
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> ```
> 安装完成后重新执行 `./run.sh` 即可。

### Q2: 拔掉数据线后，App 过几天打不开了？
> 使用个人免费 Apple ID 签名安装的 App 具备 **7 天** 本地有效期：
> - 方案 A：每隔 7 天连一次 MacBook，按一次 `⌘ + R` 重新刷入，练习记录和本地缓存数据完全保留。
> - 方案 B：在 Xcode 中通过 `Product -> Archive -> Distribute App` 走免费内部 TestFlight 分发，有效期延长至 30 天。

### Q3: 说话时麦克风没有波形或没反应？
> 请检查 iPhone 手机设置：
> - 进入 iPhone **`设置`** -> 往下拉找到 **`SpeakFlow`**；
> - 确保 **`麦克风`** 与 **`语音识别`** 权限均已开启。

---
🎉 **祝你在 1 个月内迅速形成地道纺织英语母语直觉！**
