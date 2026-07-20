import Foundation

/// 从 Bundle 加载 26 个场景对话 + 词典（离线可用）
public enum ScenarioLoader {
    /// Bundle 子目录：SpeakFlowKit_SpeakFlowKit.bundle/Scenarios/*.json
    public static func loadDialog(scenarioId: String, difficulty: String) throws -> ScenarioDialog {
        let name = "\(scenarioId)_\(difficulty)"
        return try loadDialogByName(name)
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

    /// 加载本地词典（garment-textile-dict.json）
    public static func loadDictionary() throws -> [DictionaryEntry] {
        let url = try locate("Dictionary.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([DictionaryEntry].self, from: data)
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