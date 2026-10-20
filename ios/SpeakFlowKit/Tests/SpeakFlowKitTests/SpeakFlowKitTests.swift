import XCTest
@testable import SpeakFlowKit

/// 场景加载：难度→文件名映射 + 内容格式兼容解码
final class ScenarioLoaderTests: XCTestCase {

    /// 初级文件名无后缀：claim_aftersales.json
    func testLoadBeginnerDialogUsesBaseFileName() throws {
        let dialog = try ScenarioLoader.loadDialog(scenarioId: "claim_aftersales", difficulty: "beginner")
        XCTAssertEqual(dialog.scenarioId, "claim_aftersales")
        XCTAssertEqual(dialog.difficulty, "beginner")
        XCTAssertFalse(dialog.rounds.isEmpty)
    }

    /// 中级带 _intermediate 后缀
    func testLoadIntermediateDialog() throws {
        let dialog = try ScenarioLoader.loadDialog(scenarioId: "claim_aftersales", difficulty: "intermediate")
        XCTAssertEqual(dialog.difficulty, "intermediate")
        XCTAssertFalse(dialog.rounds.isEmpty)
    }

    /// 中文难度字符串兼容
    func testLoadDialogWithChineseDifficulty() throws {
        let dialog = try ScenarioLoader.loadDialog(scenarioId: "claim_aftersales", difficulty: "初级")
        XCTAssertEqual(dialog.scenarioId, "claim_aftersales")
        XCTAssertFalse(dialog.rounds.isEmpty)
    }

    /// Bundle 内容格式（ai_message 系列字段）应映射到 DialogRound 公开字段
    func testContentFormatDecodingMapsToPublicFields() throws {
        let dialog = try ScenarioLoader.loadDialog(scenarioId: "claim_aftersales", difficulty: "beginner")
        let first = try XCTUnwrap(dialog.rounds.first)
        XCTAssertEqual(first.speaker, .partner)
        XCTAssertFalse(first.textEn.isEmpty)
        XCTAssertFalse(first.textZh.isEmpty)
        XCTAssertNotNil(first.keyWords)
        XCTAssertFalse(first.keyWords?.isEmpty ?? true)
    }

    /// 本地词典可加载
    func testLoadDictionary() throws {
        let entries = try ScenarioLoader.loadDictionary()
        XCTAssertFalse(entries.isEmpty)
    }
}

/// 生词本 Anki CSV 导出转义
final class VocabularyCSVTests: XCTestCase {

    @MainActor
    func testExportAnkiCSVEscapesSpecialCharacters() throws {
        let store = VocabularyStore()
        // 含逗号 + 引号的词条，验证 RFC4180 风格转义
        let item = VocabularyItem(
            word: "csv,test\"q",
            phonetic: "/test/",
            partOfSpeech: "n.",
            definitionEn: "plain",
            definitionZh: "含,逗号",
            example: "say \"hi\"",
            addedAt: Date(timeIntervalSince1970: 1_700_000_000),
            reviewCount: 0,
            lastReviewedAt: nil,
            difficulty: 2
        )
        try store.add(item)
        defer { try? store.delete(word: item.word) }

        let csv = try store.exportAnkiCSV()
        XCTAssertTrue(csv.hasPrefix("Word,Phonetic,Definition,Example,Difficulty,Added\n"))
        // 逗号字段加引号；内部引号双写
        XCTAssertTrue(csv.contains("\"csv,test\"\"q\""), "单词字段未正确转义: \(csv)")
        XCTAssertTrue(csv.contains("\"含,逗号\""), "释义字段未正确转义: \(csv)")
        XCTAssertTrue(csv.contains("\"say \"\"hi\"\"\""), "例句字段未正确转义: \(csv)")
        // 无特殊字符字段保持原样
        XCTAssertTrue(csv.contains(",/test/,"), "音标字段不应加引号: \(csv)")
    }
}

/// 学习计划：两周轮回 + 确定性编排 + 打卡状态
final class LearningPlanTests: XCTestCase {

    @MainActor
    func testCycleDaysIsFourteen() {
        XCTAssertEqual(LearningPlanStore.cycleDays, 14)
    }

    /// 同一周期同一天，计划稳定（确定性洗牌）
    @MainActor
    func testPlanIsDeterministicWithinCycle() {
        let store = LearningPlanStore.shared
        let a = store.plannedScenarioIds(cycle: 0, day: 3)
        let b = store.plannedScenarioIds(cycle: 0, day: 3)
        XCTAssertEqual(a, b)
        XCTAssertFalse(a.isEmpty)
    }

    /// 一个周期 14 天合起来应覆盖全部基础场景（不重复）
    @MainActor
    func testCycleCoversAllScenarios() {
        let store = LearningPlanStore.shared
        var all: Set<String> = []
        for day in 1...LearningPlanStore.cycleDays {
            let ids = store.plannedScenarioIds(cycle: 0, day: day)
            for id in ids {
                XCTAssertFalse(all.contains(id), "场景 \(id) 在周期内重复分配")
                all.insert(id)
            }
        }
        let total = (try? ScenarioLoader.loadScenarioMetadata())?
            .filter { !$0.id.hasSuffix("_intermediate") && !$0.id.hasSuffix("_advanced") }
            .count ?? 0
        XCTAssertEqual(all.count, total, "一个周期应覆盖全部 \(total) 个基础场景")
    }

    /// 完成练习记录幂等 + 计划完成后判定已打卡
    @MainActor
    func testRecordCompletionAndAutoCheckIn() {
        let store = LearningPlanStore.shared
        let today = store.todayKey
        let plan = store.plannedScenarioIds(cycle: store.cycleIndex, day: store.dayInCycle)
        // 备份原记录，测试后还原（nil 赋给下标即移除该 key）
        let backup = store.records[today]
        defer {
            var r = store.records
            r[today] = backup
            store.records = r
        }

        for id in plan {
            store.recordPracticeCompletion(scenarioId: id)
            store.recordPracticeCompletion(scenarioId: id) // 重复记录应幂等
        }
        XCTAssertEqual(Set(store.records[today]?.completed ?? []), Set(plan))
        XCTAssertTrue(store.isTodayCheckedIn)
    }
}
