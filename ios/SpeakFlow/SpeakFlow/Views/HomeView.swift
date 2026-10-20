import SwiftUI
import SpeakFlowKit

/// 首页：今日一句 + 生词本 + 场景列表（直接开始练习）
struct HomeView: View {
    /// 用于点击生词本卡片切换 Tab
    @Binding var selectedTab: Int

    @State private var todayEntry: DictionaryEntry?
    @State private var wordCount: Int = 0
    @State private var backendOnline: Bool = false
    @State private var healthChecked: Bool = false

    /// 学习计划 + 打卡（两周一个轮回）
    @ObservedObject private var plan = LearningPlanStore.shared

    // 场景列表数据（从 ScenariosView 合并过来）
    @State private var rows: [ScenarioRowData] = []
    @State private var isLoading: Bool = true
    @State private var isOffline: Bool = false
    @State private var pickerTarget: ScenarioRowData?
    @State private var route: PracticeRoute?

    /// 按分类分组（保持出现顺序）
    private var grouped: [(String, [ScenarioRowData])] {
        var order: [String] = []
        var map: [String: [ScenarioRowData]] = [:]
        for r in rows {
            if map[r.category] == nil { order.append(r.category) }
            map[r.category, default: []].append(r)
        }
        return order.map { ($0, map[$0] ?? []) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headerSection
                    planSection
                    dailyRow
                    scenariosSection
                    Spacer(minLength: 0)
                }
                .padding()
            }
            .navigationTitle("首页")
            .tint(Color.kleinBlue)
            .confirmationDialog("选择难度", isPresented: Binding(
                get: { pickerTarget != nil },
                set: { if !$0 { pickerTarget = nil } }
            ), titleVisibility: .visible) {
                if let target = pickerTarget {
                    ForEach(target.difficulties, id: \.self) { d in
                        Button(difficultyLabel(d)) {
                            let selection = PracticeRoute(scenarioId: target.id, difficulty: d, title: target.titleZh)
                            pickerTarget = nil
                            // 等 confirmationDialog 关闭动画完成后再 push，避免 iOS 17 导航状态冲突闪退
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                route = selection
                            }
                        }
                    }
                }
                Button("取消", role: .cancel) { pickerTarget = nil }
            }
            .navigationDestination(item: $route) { r in
                PracticeView(scenarioId: r.scenarioId, difficulty: r.difficulty, scenarioTitle: r.title)
            }
        }
        .task {
            loadTodayWord()
            loadWordCount()
            await checkHealth()
            await loadScenarios()
        }
        .onAppear {
            // 练习页返回 / 跨天时刷新计划与打卡状态
            plan.refresh()
        }
    }

    // MARK: - 子视图

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("H Talk")
                    .font(.largeTitle).bold()
                    .foregroundStyle(.white)
                Spacer()
                backendStatusDot
            }
            Text("服装纺织英语口语练习")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.85))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(
            LinearGradient(
                gradient: Gradient(colors: [Color.kleinBlue, Color.kleinBlue.opacity(0.7)]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: Color.kleinBlue.opacity(0.25), radius: 8, x: 0, y: 4)
    }

    /// 后端在线状态小圆点（白色样式，适配蓝色头部）
    private var backendStatusDot: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(backendOnline ? Color.green : (healthChecked ? Color.red : Color.white.opacity(0.7)))
                .frame(width: 10, height: 10)
            Text(backendOnline ? "后端在线" : (healthChecked ? "离线模式" : "检测中…"))
                .font(.caption)
                .foregroundStyle(.white.opacity(0.9))
        }
    }

    /// 今日一句 + 生词本：并排紧凑卡片
    private var dailyRow: some View {
        HStack(spacing: 12) {
            todayCompact
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            wordbookCompact
                .frame(width: 100, alignment: .center)
        }
        .frame(height: 120, alignment: .top)
    }

    // MARK: - 学习计划 + 打卡（两周一个轮回）

    private var planSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 标题行：计划名 + 周期日徽标 + 连续打卡
            HStack(spacing: 8) {
                Label("两周学习计划", systemImage: "calendar.badge.clock")
                    .font(.headline)
                    .foregroundStyle(Color.kleinBlue)
                Spacer()
                if plan.streak > 0 {
                    Text("🔥 连续 \(plan.streak) 天")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.orange)
                }
                Text("第 \(plan.dayInCycle)/\(LearningPlanStore.cycleDays) 天")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.kleinBlue.opacity(0.12))
                    .foregroundStyle(Color.kleinBlue)
                    .clipShape(Capsule())
            }

            // 14 天打卡点阵（两行七列 = 两周）
            cycleDotsGrid

            // 周期进度条
            VStack(alignment: .leading, spacing: 4) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.kleinBlue.opacity(0.12))
                        Capsule().fill(Color.kleinBlue)
                            .frame(width: geo.size.width * min(1, Double(plan.cycleCheckedCount) / Double(LearningPlanStore.cycleDays)))
                    }
                }
                .frame(height: 6)
                Text("本周期已打卡 \(plan.cycleCheckedCount)/\(LearningPlanStore.cycleDays) 天")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Divider().background(Color.kleinBlue.opacity(0.12))

            // 今日任务
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("今日任务")
                        .font(.subheadline.bold())
                        .foregroundStyle(Color.kleinBlue)
                    Spacer()
                    Text("\(plan.todayDoneCount)/\(plan.todayPlan.count)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ForEach(plan.todayPlan) { item in
                    planScenarioRow(item)
                }
            }

            // 打卡状态 / 手动补卡
            if plan.isTodayCheckedIn {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Text("今日已打卡，太棒了！")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.green)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.green.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            } else {
                Button {
                    plan.manualCheckInToday()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "hand.tap.fill")
                        Text("手动打卡（自由练习日）")
                            .fontWeight(.medium)
                    }
                    .font(.caption)
                    .foregroundStyle(Color.kleinBlue)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    .background(Color.kleinBlue.opacity(0.08))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(14)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.kleinBlue.opacity(0.15), lineWidth: 1)
        )
    }

    /// 14 天打卡点阵：两行七列，今天高亮描边
    private var cycleDotsGrid: some View {
        let checks = plan.currentCycleChecks
        return VStack(spacing: 6) {
            ForEach(0..<2, id: \.self) { week in
                HStack(spacing: 0) {
                    ForEach(1...7, id: \.self) { weekday in
                        let day = week * 7 + weekday
                        let checked = checks.indices.contains(day - 1) ? checks[day - 1] : false
                        let isToday = day == plan.dayInCycle
                        ZStack {
                            Circle()
                                .fill(checked ? Color.kleinBlue : Color.kleinBlue.opacity(0.12))
                                .frame(width: 22, height: 22)
                            if checked {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundStyle(.white)
                            } else {
                                Text("\(day)")
                                    .font(.system(size: 9))
                                    .foregroundStyle(Color.kleinBlue.opacity(0.6))
                            }
                            if isToday {
                                Circle()
                                    .stroke(Color.orange, lineWidth: 2)
                                    .frame(width: 27, height: 27)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
    }

    /// 今日任务单个场景行：点击走难度选择 → 练习页
    private func planScenarioRow(_ item: PlanScenario) -> some View {
        Button {
            guard !item.done else { return }
            let files = ScenarioLoader.allScenarioFiles()
            pickerTarget = ScenarioRowData(
                id: item.id,
                titleZh: item.titleZh,
                titleEn: item.titleEn,
                category: item.category,
                emoji: item.emoji,
                difficulties: localDifficulties(for: item.id, files: files)
            )
        } label: {
            HStack(spacing: 10) {
                Text(item.emoji)
                    .font(.body)
                    .frame(width: 28, height: 28)
                    .background(item.done ? Color.green.opacity(0.12) : Color.kleinBlue.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Text(item.titleZh)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(item.done ? .secondary : .primary)
                    .strikethrough(item.done, color: .secondary)
                    .lineLimit(1)
                Spacer()
                Image(systemName: item.done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.done ? .green : Color.kleinBlue.opacity(0.4))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(item.done ? Color.green.opacity(0.06) : Color.kleinBlue.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    /// 今日一句（紧凑版）
    private var todayCompact: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "quote.bubble.fill")
                    .font(.caption2)
                    .foregroundStyle(Color.kleinBlue)
                Text("今日一句")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.kleinBlue)
                Spacer()
                if let source = todayEntry?.source {
                    Text(sourceLabel(source))
                        .font(.caption2)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(source == "scenario" ? Color.kleinBlue.opacity(0.12) : Color.green.opacity(0.12))
                        .foregroundStyle(source == "scenario" ? Color.kleinBlue : Color.green)
                        .clipShape(Capsule())
                }
            }
            if let entry = todayEntry {
                Text(entry.word)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                if let zh = entry.definitionZh ?? entry.definitionEn {
                    Text(zh)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
            } else {
                Text("加载中…")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.secondarySystemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.kleinBlue.opacity(0.15), lineWidth: 1)
        )
    }

    /// 生词本（紧凑版）
    private var wordbookCompact: some View {
        Button {
            selectedTab = 1
        } label: {
            VStack(spacing: 6) {
                Image(systemName: "book.fill")
                    .font(.title2)
                    .foregroundStyle(.white)
                Text("\(wordCount)")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                Text("生词本")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.85))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.kleinBlue)
            )
        }
        .buttonStyle(.plain)
    }

    private func sourceLabel(_ source: String) -> String {
        switch source {
        case "scenario": return "场景"
        case "vocabulary": return "生词"
        default: return source
        }
    }

    /// 场景列表（原 ScenariosView 合并到首页），按大模块/分类分组展示
    private var scenariosSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Label("选择场景开始练习", systemImage: "square.grid.2x2.fill")
                    .font(.headline)
                    .foregroundStyle(Color.kleinBlue)
                Spacer()
                if isOffline {
                    Text("离线模式").font(.caption).foregroundStyle(.secondary)
                }
            }

            if isLoading {
                ProgressView("加载场景…")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else if rows.isEmpty {
                Text("暂无可用场景").foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 20) {
                    ForEach(grouped, id: \.0) { category, items in
                        categoryCard(category: category, items: items)
                    }
                }
            }
        }
    }

    /// 单个分类大模块卡片
    private func categoryCard(category: String, items: [ScenarioRowData]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Circle()
                    .fill(categoryColor(category))
                    .frame(width: 10, height: 10)
                Text(categoryTitle(category))
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.kleinBlue)
                Spacer()
                Text("\(items.count) 个场景")
                    .font(.caption)
                    .foregroundStyle(Color.kleinBlue.opacity(0.7))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.kleinBlue.opacity(0.08))

            Divider()
                .background(Color.kleinBlue.opacity(0.12))

            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, row in
                    scenarioRow(row)
                    if index < items.count - 1 {
                        Divider()
                            .padding(.leading, 56)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.kleinBlue.opacity(0.1), lineWidth: 1)
        )
    }

    private func scenarioRow(_ row: ScenarioRowData) -> some View {
        Button {
            pickerTarget = row
        } label: {
            HStack(spacing: 12) {
                Text(row.emoji).font(.title2)
                    .frame(width: 36, height: 36)
                    .background(Color.kleinBlue.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.titleZh).font(.headline).foregroundStyle(.primary)
                    Text(row.titleEn).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                HStack(spacing: 4) {
                    ForEach(row.difficulties, id: \.self) { d in
                        Text(difficultyLabel(d))
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.kleinBlue.opacity(0.12))
                            .foregroundStyle(Color.kleinBlue)
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
    }

    // MARK: - 分类展示辅助

    /// 分类中文展示名（业务维度）
    private func categoryTitle(_ category: String) -> String {
        businessCategory(for: category).title
    }

    /// 分类主题色
    private func categoryColor(_ category: String) -> Color {
        businessCategory(for: category).color
    }

    /// 业务维度分类映射
    private func businessCategory(for category: String) -> (title: String, color: Color) {
        switch category.lowercased() {
        case "sincetech", "rd", "innovation":
            return ("信泰前沿实战", Color.kleinBlue)
        case "communication", "sales", "business":
            return ("商务洽谈", Color.kleinBlue)
        case "refine":
            return ("订单对接", Color.orange)
        case "operations", "product":
            return ("生产质量", Color.green)
        case "process", "weaving":
            return ("工艺技术", Color.cyan)
        case "logistics":
            return ("物流关务", Color.purple)
        case "service":
            return ("售后财务", Color.red)
        case "local":
            return ("本地场景", Color.gray)
        default:
            return (category, Color.accentColor)
        }
    }

    // MARK: - 数据加载

    private func loadWordCount() {
        wordCount = (try? VocabularyStore.shared.all().count) ?? 0
    }

    /// 今日一句：从场景对话例句 + 生词本中按日期稳定随机抽取
    private func loadTodayWord() {
        var candidates: [DictionaryEntry] = []

        // 1) 所有场景对话里的英文句子
        let files = ScenarioLoader.allScenarioFiles().sorted()
        for file in files {
            guard let dialog = try? ScenarioLoader.loadDialogByName(file) else { continue }
            for round in dialog.rounds where !round.textEn.isEmpty {
                candidates.append(DictionaryEntry(
                    word: round.textEn,
                    phonetic: nil,
                    partOfSpeech: nil,
                    definitionEn: nil,
                    definitionZh: round.textZh,
                    example: "来自场景：\(dialog.scenarioTitleZh)",
                    source: "scenario"
                ))
            }
        }

        // 2) 生词本里的词
        if let words = try? VocabularyStore.shared.all() {
            for item in words where !item.word.isEmpty {
                candidates.append(DictionaryEntry(
                    word: item.word,
                    phonetic: item.phonetic,
                    partOfSpeech: item.partOfSpeech,
                    definitionEn: item.definitionEn,
                    definitionZh: item.definitionZh,
                    example: item.example,
                    source: "vocabulary"
                ))
            }
        }

        guard !candidates.isEmpty else { return }
        let day = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 0
        todayEntry = candidates[day % candidates.count]
    }

    private func checkHealth() async {
        backendOnline = (try? await APIClient.shared.health()) ?? false
        healthChecked = true
    }

    private func loadScenarios() async {
        let files = ScenarioLoader.allScenarioFiles()
        do {
            let scenarios = try await APIClient.shared.fetchScenarios()
            rows = scenarios.map { s in
                let local = localDifficulties(for: s.id, files: files)
                return ScenarioRowData(
                    id: s.id,
                    titleZh: s.titleZh,
                    titleEn: s.titleEn,
                    category: s.category,
                    emoji: s.coverEmoji ?? emojiFor(id: s.id),
                    difficulties: local.isEmpty ? s.difficulty : local
                )
            }
            isOffline = false
        } catch {
            rows = loadOfflineRows(files: files)
            isOffline = true
        }
        isLoading = false
    }

    /// 离线兜底：优先读 Bundle 内 scenarios.json 的真实分类
    private func loadOfflineRows(files: [String]) -> [ScenarioRowData] {
        if let metadata = try? ScenarioLoader.loadScenarioMetadata() {
            return metadata.compactMap { m in
                let local = localDifficulties(for: m.id, files: files)
                guard !local.isEmpty else { return nil }
                return ScenarioRowData(
                    id: m.id,
                    titleZh: m.titleZh,
                    titleEn: m.titleEn,
                    category: m.category,
                    emoji: m.icon.isEmpty ? emojiFor(id: m.id) : m.icon,
                    difficulties: local
                )
            }
        }
        // 兜底：逐个读初级对话文件
        let baseIds = files.filter { !$0.hasSuffix("_intermediate") && !$0.hasSuffix("_advanced") }.sorted()
        return baseIds.compactMap { id in
            guard let d = try? ScenarioLoader.loadDialogByName(id) else { return nil }
            return ScenarioRowData(
                id: id,
                titleZh: d.scenarioTitleZh,
                titleEn: d.scenarioTitleEn,
                category: "本地场景",
                emoji: emojiFor(id: id),
                difficulties: localDifficulties(for: id, files: files)
            )
        }
    }

    /// 只列 Bundle 里实际存在的难度文件
    private func localDifficulties(for id: String, files: [String]) -> [String] {
        var result: [String] = []
        if files.contains(id) { result.append("beginner") }
        if files.contains("\(id)_intermediate") { result.append("intermediate") }
        if files.contains("\(id)_advanced") { result.append("advanced") }
        return result
    }

    /// 离线模式下的默认 emoji（在线时以后端 cover_emoji 为准）
    private func emojiFor(id: String) -> String {
        let map: [String: String] = [
            "phone_meeting": "📞", "inquiry_quote": "📨", "claim_aftersales": "⚖️",
            "customs_hold": "🛃", "factory_audit": "🏭", "trade_fair": "🎪",
            "logistics_shipping": "🚢", "order_management": "📋", "payment_overdue": "💰",
            "sample_development": "🧵", "lc_discrepancy": "📄"
        ]
        return map[id] ?? "🗣"
    }
}

#Preview {
    HomeView(selectedTab: .constant(0))
}
