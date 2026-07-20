import Foundation
import SwiftData

/// 生词本持久化存储（SwiftData, iOS 17+）
@MainActor
public final class VocabularyStore {
    public static let shared = VocabularyStore()

    private let container: ModelContainer

    public init() {
        do {
            container = try ModelContainer(for: VocabularyRecord.self)
        } catch {
            // 内存 fallback（极端情况：SwiftData 初始化失败）
            let config = ModelConfiguration(isStoredInMemoryOnly: true)
            // 上面的 init 失败时强制走这里
            container = try! ModelContainer(for: VocabularyRecord.self, configurations: config)
        }
    }

    private var context: ModelContext { container.mainContext }

    // MARK: - CRUD

    /// 添加生词（重复则更新难度评分）
    public func add(_ item: VocabularyItem) throws {
        let descriptor = FetchDescriptor<VocabularyRecord>(predicate: #Predicate { $0.word == item.word })
        if let existing = try context.fetch(descriptor).first {
            existing.difficulty = item.difficulty
            existing.lastReviewedAt = Date()
        } else {
            context.insert(VocabularyRecord(from: item))
        }
        try context.save()
    }

    public func all() throws -> [VocabularyItem] {
        try context.fetch(FetchDescriptor<VocabularyRecord>(sortBy: [SortDescriptor(\.addedAt, order: .reverse)]))
            .map { $0.toItem() }
    }

    public func delete(word: String) throws {
        let descriptor = FetchDescriptor<VocabularyRecord>(predicate: #Predicate { $0.word == word })
        for r in try context.fetch(descriptor) {
            context.delete(r)
        }
        try context.save()
    }

    public func contains(word: String) throws -> Bool {
        let descriptor = FetchDescriptor<VocabularyRecord>(predicate: #Predicate { $0.word == word })
        return try !context.fetch(descriptor).isEmpty
    }

    /// 导出为 Anki CSV（与 Web 版 v2.1 一致）
    public func exportAnkiCSV() throws -> String {
        let items = try all()
        var csv = "Word,Phonetic,Definition,Example,Difficulty,Added\n"
        let df = ISO8601DateFormatter()
        for it in items {
            let cols = [
                escape(it.word),
                escape(it.phonetic ?? ""),
                escape(it.definitionZh ?? it.definitionEn ?? ""),
                escape(it.example ?? ""),
                "\(it.difficulty)",
                df.string(from: it.addedAt)
            ]
            csv += cols.joined(separator: ",") + "\n"
        }
        return csv
    }

    private func escape(_ s: String) -> String {
        if s.contains(",") || s.contains("\"") || s.contains("\n") {
            return "\"\(s.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return s
    }
}

/// SwiftData 持久化模型（与 VocabularyItem 互转）
@Model
public final class VocabularyRecord {
    @Attribute(.unique) public var word: String
    public var phonetic: String?
    public var partOfSpeech: String?
    public var definitionEn: String?
    public var definitionZh: String?
    public var example: String?
    public var addedAt: Date
    public var reviewCount: Int
    public var lastReviewedAt: Date?
    public var difficulty: Int

    public init(from item: VocabularyItem) {
        self.word = item.word
        self.phonetic = item.phonetic
        self.partOfSpeech = item.partOfSpeech
        self.definitionEn = item.definitionEn
        self.definitionZh = item.definitionZh
        self.example = item.example
        self.addedAt = item.addedAt
        self.reviewCount = item.reviewCount
        self.lastReviewedAt = item.lastReviewedAt
        self.difficulty = item.difficulty
    }

    public func toItem() -> VocabularyItem {
        VocabularyItem(
            word: word,
            phonetic: phonetic,
            partOfSpeech: partOfSpeech,
            definitionEn: definitionEn,
            definitionZh: definitionZh,
            example: example,
            addedAt: addedAt,
            reviewCount: reviewCount,
            lastReviewedAt: lastReviewedAt,
            difficulty: difficulty
        )
    }
}