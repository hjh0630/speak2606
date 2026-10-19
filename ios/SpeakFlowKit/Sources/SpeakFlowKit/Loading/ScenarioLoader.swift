import Foundation

/// 从 Bundle 加载 26 个场景对话 + 词典（离线可用）
public enum ScenarioLoader {
    /// Bundle 子目录：SpeakFlowKit_SpeakFlowKit.bundle/Scenarios/*.json
    /// 命名规则：初级无后缀（claim_aftersales.json），中级/高级带 _intermediate/_advanced
    public static func loadDialog(scenarioId: String, difficulty: String) throws -> ScenarioDialog {
        let d = difficulty.lowercased()
        let suffix: String
        if d == "beginner" || difficulty == "初级" {
            suffix = ""  // 初级文件名无后缀
        } else if d == "intermediate" || difficulty == "中级" {
            suffix = "_intermediate"
        } else if d == "advanced" || difficulty == "高级" {
            suffix = "_advanced"
        } else {
            suffix = "_\(difficulty)"  // 未知难度字符串：先按旧规则拼，失败再回退
        }
        do {
            return try loadDialogByName(scenarioId + suffix)
        } catch {
            if suffix.isEmpty { throw error }
            // 部分场景只有初级文件（如 trade_fair），回退到无后缀版本
            return try loadDialogByName(scenarioId)
        }
    }

    public static func loadDialogByName(_ fileName: String) throws -> ScenarioDialog {
        let url = try locate(fileName + ".json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(ScenarioDialog.self, from: data)
    }

    /// 列出 Bundle 内全部场景（不联网）
    public static func allScenarioFiles() -> [String] {
        guard let url = bundleResourceURL() else { return [] }
        let dir = url.appendingPathComponent("Scenarios", isDirectory: true)
        guard let files = try? FileManager.default.contentsOfDirectory(atPath: dir.path) else { return [] }
        return files.filter { $0.hasSuffix(".json") }.map { ($0 as NSString).deletingPathExtension }
    }

    /// 场景元数据（离线 fallback，与后端 /api/scenarios 字段对齐）
    public struct ScenarioMetadata: Codable {
        public let id: String
        public let titleZh: String
        public let titleEn: String
        public let category: String
        public let icon: String
        public let difficultyLevels: [String]

        enum CodingKeys: String, CodingKey {
            case id
            case titleZh = "title_zh"
            case titleEn = "title_en"
            case category
            case icon
            case difficultyLevels = "difficulty_levels"
        }
    }

    /// 加载 Bundle 内 scenarios.json（离线也能按真实业务分类展示）
    public static func loadScenarioMetadata() throws -> [ScenarioMetadata] {
        let url = try locate("scenarios.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([ScenarioMetadata].self, from: data)
    }

    /// 加载本地词典（345 词条）
    /// 实际文件格式是 map：{ "_comment": "...", "word": ["释义1","释义2"] }，
    /// 这里转成 DictionaryEntry（word + definitionZh 合并，source = "local"）
    public static func loadDictionary() throws -> [DictionaryEntry] {
        let url = try locate("Dictionary.json")
        let data = try Data(contentsOf: url)
        guard let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "ScenarioLoader", code: -3,
                          userInfo: [NSLocalizedDescriptionKey: "Dictionary.json 格式不是词典 map"])
        }
        return obj.compactMap { key, value in
            guard key != "_comment", let defs = value as? [String] else { return nil }
            return DictionaryEntry(
                word: key,
                phonetic: nil,
                partOfSpeech: nil,
                definitionEn: nil,
                definitionZh: defs.joined(separator: "；"),
                example: nil,
                source: "local"
            )
        }.sorted { $0.word < $1.word }
    }

    // MARK: - Bundle 路径查找（兼容 SPM 处理过的 resources）

    private static func bundleResourceURL() -> URL? {
        Bundle.module.resourceURL
    }

    private static func locate(_ fileName: String) throws -> URL {
        guard let base = bundleResourceURL() else {
            throw NSError(domain: "ScenarioLoader", code: -1,
                          userInfo: [NSLocalizedDescriptionKey: "Bundle.module.resourceURL is nil — 检查 Package.swift resources 配置"])
        }
        // 1. 直接在 Resources 根
        let direct = base.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: direct.path) { return direct }
        // 2. 在 Resources/Scenarios/
        let inScenarios = base.appendingPathComponent("Scenarios").appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: inScenarios.path) { return inScenarios }
        throw NSError(domain: "ScenarioLoader", code: -2,
                      userInfo: [NSLocalizedDescriptionKey: "未找到资源: \(fileName)"])
    }
}