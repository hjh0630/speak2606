import SwiftUI
import SpeakFlowKit

/// 场景行展示数据（统一在线 API 与离线 Bundle 两种来源）
/// 注：仓库 ../content/scenarios.json 是后端 /api/scenarios 的数据源（含 icon/category），
///     iOS 端在线时直接走 API；离线时用 Bundle 内场景 JSON 兜底（无分类信息，归入"本地场景"）。
struct ScenarioRowData: Identifiable, Hashable {
    let id: String
    let titleZh: String
    let titleEn: String
    let category: String
    let emoji: String
    let difficulties: [String]   // Bundle 里实际存在的难度
}

/// 练习页路由
struct PracticeRoute: Identifiable, Hashable {
    let scenarioId: String
    let difficulty: String
    let title: String
    var id: String { "\(scenarioId)|\(difficulty)" }
}

/// 难度中文标签
func difficultyLabel(_ d: String) -> String {
    switch d.lowercased() {
    case "beginner": return "初级"
    case "intermediate": return "中级"
    case "advanced": return "高级"
    default: return d
    }
}

/// 业务维度分类中文展示名
func categoryTitle(_ category: String) -> String {
    businessCategory(for: category).title
}

/// 业务维度分类主题色
func categoryColor(_ category: String) -> Color {
    businessCategory(for: category).color
}

/// 业务维度分类映射
func businessCategory(for category: String) -> (title: String, color: Color) {
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

/// 场景列表：在线走 APIClient，离线回退 Bundle 本地场景
struct ScenariosView: View {
    @State private var rows: [ScenarioRowData] = []
    @State private var isLoading: Bool = true
    @State private var isOffline: Bool = false
    @State private var loadError: String?
    @State private var pickerTarget: ScenarioRowData?      // 难度选择弹窗目标
    @State private var route: PracticeRoute?               // 导航到练习页

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
            Group {
                if isLoading {
                    ProgressView("加载场景…")
                } else if rows.isEmpty {
                    Text("暂无可用场景").foregroundStyle(.secondary)
                } else {
                    List {
                        if isOffline {
                            Section {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("离线模式 · 展示本地场景").font(.caption).foregroundStyle(.secondary)
                                    if let loadError {
                                        Text("原因：\(loadError)").font(.caption2).foregroundStyle(.orange)
                                    }
                                }
                            }
                        }
                        ForEach(grouped, id: \.0) { category, items in
                            Section {
                                ForEach(items) { row in
                                    scenarioRow(row)
                                }
                            } header: {
                                HStack(spacing: 8) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(categoryColor(category))
                                        .frame(width: 4, height: 18)
                                    Text(categoryTitle(category))
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(categoryColor(category))
                                    Spacer()
                                    Text("\(items.count) 个场景")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                        }
                    }
                }
            }
            .navigationTitle("场景")
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
        .task { await loadScenarios() }
    }

    private func scenarioRow(_ row: ScenarioRowData) -> some View {
        Button {
            pickerTarget = row
        } label: {
            HStack(spacing: 12) {
                Text(row.emoji).font(.title2)
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
                            .background(Color(.tertiarySystemBackground))
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    // MARK: - 数据加载

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
            loadError = nil
        } catch {
            rows = loadOfflineRows(files: files, error: error)
            isOffline = true
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    /// 离线兜底：优先读 Bundle 内 scenarios.json 的真实分类；读不到再回退到对话文件
    private func loadOfflineRows(files: [String], error: Error? = nil) -> [ScenarioRowData] {
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
    ScenariosView()
}
