import Foundation

/// 单日打卡记录（按本地日期 yyyy-MM-dd 归档）
public struct DayRecord: Codable, Hashable {
    /// 当天已完成练习的场景 id（去重）
    public var completed: [String]
    /// 是否手动打卡（补卡 / 自由练习日）
    public var manual: Bool

    public init(completed: [String] = [], manual: Bool = false) {
        self.completed = completed
        self.manual = manual
    }
}

/// 今日计划中的一个场景条目（视图层直接用）
public struct PlanScenario: Identifiable, Hashable {
    public let id: String
    public let titleZh: String
    public let titleEn: String
    public let emoji: String
    public let category: String
    public var done: Bool

    public init(id: String, titleZh: String, titleEn: String, emoji: String, category: String, done: Bool) {
        self.id = id
        self.titleZh = titleZh
        self.titleEn = titleEn
        self.emoji = emoji
        self.category = category
        self.done = done
    }
}

/// 学习计划 + 打卡 Store（全部本地 UserDefaults，不上传）
///
/// 规则：
/// - **两周一个轮回**：固定 14 天一个周期，到期自动进入下一周期（锚定首次启动日）。
/// - **周期内全覆盖**：每周期把 Bundle 内全部初级场景按「周期序号」做确定性洗牌，
///   均匀分配到 14 天（如 36 场景 → 8 天 3 个 + 6 天 2 个），每个周期顺序不同但同一天内稳定。
/// - **打卡**：当天计划场景全部完成 → 自动打卡；也可手动补卡。
@MainActor
public final class LearningPlanStore: ObservableObject {
    public static let shared = LearningPlanStore()

    /// 一个周期的天数（两周）
    public static let cycleDays = 14

    // MARK: - 持久化

    private let defaults = UserDefaults.standard
    private enum Keys {
        static let anchor = "htalk.plan.anchor"      // 周期锚定日 yyyy-MM-dd（首个周期的第 1 天）
        static let records = "htalk.plan.records"    // [yyyy-MM-dd: DayRecord] JSON
    }

    /// 周期锚定日（本地日历当天 0 点的 dayKey）
    @Published public private(set) var anchorKey: String {
        didSet { defaults.set(anchorKey, forKey: Keys.anchor) }
    }

    /// 全部打卡记录：key = yyyy-MM-dd（setter 为 internal，供 @testable 单测还原现场）
    @Published public internal(set) var records: [String: DayRecord] {
        didSet { persist() }
    }

    public init() {
        if let a = defaults.string(forKey: Keys.anchor), !a.isEmpty {
            self.anchorKey = a
        } else {
            self.anchorKey = LearningPlanStore.dayKey(for: Date())
        }
        if let data = defaults.data(forKey: Keys.records),
           let decoded = try? JSONDecoder().decode([String: DayRecord].self, from: data) {
            self.records = decoded
        } else {
            self.records = [:]
        }
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(records) {
            defaults.set(data, forKey: Keys.records)
        }
    }

    // MARK: - 日期工具

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    public static func dayKey(for date: Date) -> String {
        formatter.string(from: date)
    }

    private static func date(for dayKey: String) -> Date? {
        formatter.date(from: dayKey)
    }

    /// 从锚定日到指定日期过了多少天（负数说明系统时间被往回拨了，按 0 处理）
    private func daysSinceAnchor(on dayKey: String) -> Int {
        guard let start = LearningPlanStore.date(for: anchorKey),
              let day = LearningPlanStore.date(for: dayKey) else { return 0 }
        let days = Calendar.current.dateComponents([.day], from: start, to: day).day ?? 0
        return max(0, days)
    }

    // MARK: - 周期状态

    /// 当前是第几个周期（0 起）
    public var cycleIndex: Int {
        daysSinceAnchor(on: LearningPlanStore.dayKey(for: Date())) / LearningPlanStore.cycleDays
    }

    /// 今天是本周期第几天（1...14）
    public var dayInCycle: Int {
        daysSinceAnchor(on: LearningPlanStore.dayKey(for: Date())) % LearningPlanStore.cycleDays + 1
    }

    public var todayKey: String { LearningPlanStore.dayKey(for: Date()) }

    // MARK: - 计划编排（确定性，不持久化）

    /// 全部可编排的基础场景（按 id 排序保证稳定）
    private func baseScenarios() -> [ScenarioLoader.ScenarioMetadata] {
        (try? ScenarioLoader.loadScenarioMetadata())?
            .filter { !$0.id.hasSuffix("_intermediate") && !$0.id.hasSuffix("_advanced") }
            .sorted { $0.id < $1.id } ?? []
    }

    /// 稳定哈希（FNV-1a 32bit），用于按周期种子洗牌
    private func stableHash(_ s: String) -> UInt32 {
        var hash: UInt32 = 2166136261
        for b in s.utf8 {
            hash ^= UInt32(b)
            hash = hash &* 16777619
        }
        return hash
    }

    /// 某周期内的场景顺序：以周期序号为种子洗牌（同一周期内各天稳定，跨周期换序）
    private func shuffledIds(cycle: Int) -> [String] {
        baseScenarios()
            .map { (id: $0.id, key: stableHash("cycle\(cycle)::\($0.id)")) }
            .sorted { $0.key < $1.key }
            .map { $0.id }
    }

    /// 某周期第 day（1...14）天计划练习的场景 id 列表（均匀分配，全周期覆盖全部场景）
    public func plannedScenarioIds(cycle: Int, day: Int) -> [String] {
        let ids = shuffledIds(cycle: cycle)
        guard !ids.isEmpty else { return [] }
        let total = ids.count
        let days = LearningPlanStore.cycleDays
        if total <= days {
            // 场景比天数少：一天一个，循环取
            return [ids[(day - 1) % total]]
        }
        let base = total / days
        let extra = total % days
        let d = min(max(day - 1, 0), days - 1)
        let start = d * base + min(d, extra)
        let count = base + (d < extra ? 1 : 0)
        return Array(ids[start..<min(start + count, total)])
    }

    /// 今日计划（带标题 / emoji / 完成态）
    public var todayPlan: [PlanScenario] {
        let meta = Dictionary(uniqueKeysWithValues: baseScenarios().map { ($0.id, $0) })
        let done = Set(records[todayKey]?.completed ?? [])
        return plannedScenarioIds(cycle: cycleIndex, day: dayInCycle).map { id in
            let m = meta[id]
            return PlanScenario(
                id: id,
                titleZh: m?.titleZh ?? id,
                titleEn: m?.titleEn ?? "",
                emoji: (m?.icon.isEmpty == false) ? m!.icon : "🗣",
                category: m?.category ?? "",
                done: done.contains(id)
            )
        }
    }

    // MARK: - 打卡

    /// 练习完成（PracticeView 结束时调用）：记录场景，幂等
    public func recordPracticeCompletion(scenarioId: String) {
        let key = todayKey
        var rec = records[key] ?? DayRecord()
        if !rec.completed.contains(scenarioId) {
            rec.completed.append(scenarioId)
        }
        records[key] = rec
    }

    /// 手动补卡（自由练习 / 线下学习日）
    public func manualCheckInToday() {
        let key = todayKey
        var rec = records[key] ?? DayRecord()
        rec.manual = true
        records[key] = rec
    }

    /// 某一天是否已打卡：手动打卡 或 当天计划全部完成
    public func isCheckedIn(dayKey: String) -> Bool {
        guard let rec = records[dayKey] else { return false }
        if rec.manual { return true }
        let days = daysSinceAnchor(on: dayKey)
        let cycle = days / LearningPlanStore.cycleDays
        let day = days % LearningPlanStore.cycleDays + 1
        let planned = Set(plannedScenarioIds(cycle: cycle, day: day))
        return !planned.isEmpty && planned.isSubset(of: Set(rec.completed))
    }

    /// 今日是否已打卡
    public var isTodayCheckedIn: Bool { isCheckedIn(dayKey: todayKey) }

    /// 今日已完成计划场景数
    public var todayDoneCount: Int {
        todayPlan.filter { $0.done }.count
    }

    /// 连续打卡天数（今天未打卡则从今天往前看是否还能续上：今日未完成不算断签，按昨天往前数）
    public var streak: Int {
        var count = 0
        var cursor = Date()
        // 今天还没打卡：不算断签，从昨天开始数；今天已打卡：从今天数起
        if !isTodayCheckedIn {
            cursor = Calendar.current.date(byAdding: .day, value: -1, to: cursor) ?? cursor
        }
        while true {
            let key = LearningPlanStore.dayKey(for: cursor)
            if isCheckedIn(dayKey: key) {
                count += 1
                guard let prev = Calendar.current.date(byAdding: .day, value: -1, to: cursor) else { break }
                cursor = prev
            } else {
                break
            }
        }
        return count
    }

    /// 本周期 14 天的打卡状态（供点阵图使用），索引 0 = 第 1 天
    public var currentCycleChecks: [Bool] {
        guard let anchor = LearningPlanStore.date(for: anchorKey) else {
            return Array(repeating: false, count: LearningPlanStore.cycleDays)
        }
        let cycleStartOffset = cycleIndex * LearningPlanStore.cycleDays
        return (0..<LearningPlanStore.cycleDays).map { offset in
            guard let day = Calendar.current.date(byAdding: .day, value: cycleStartOffset + offset, to: anchor) else {
                return false
            }
            return isCheckedIn(dayKey: LearningPlanStore.dayKey(for: day))
        }
    }

    /// 本周期已打卡天数
    public var cycleCheckedCount: Int {
        currentCycleChecks.filter { $0 }.count
    }

    /// 手动刷新（跨天 / 回到前台时调用）
    public func refresh() {
        // 触发 @Published 重算依赖 anchor 的派生状态
        objectWillChange.send()
    }
}
