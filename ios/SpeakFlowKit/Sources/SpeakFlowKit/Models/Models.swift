import Foundation

// MARK: - Scenario

/// 一个练习场景元数据（与后端 /api/scenarios 字段对齐）
public struct Scenario: Codable, Identifiable, Hashable {
    public let id: String              // e.g. "customs_hold"
    public let titleZh: String         // 中文标题
    public let titleEn: String         // 英文标题
    public let category: String        // 商务日常/商务异常/工艺
    public let difficulty: [String]    // ["beginner","intermediate","advanced"]
    public let coverEmoji: String?     // 封面 emoji（前端展示用）

    enum CodingKeys: String, CodingKey {
        case id
        case titleZh = "title_zh"
        case titleEn = "title_en"
        case category
        case difficulty
        case coverEmoji = "cover_emoji"
    }
}

/// 单轮对话内容（与 content/dialogs/*.json 的 rounds[] 对齐）
public struct DialogRound: Codable, Hashable {
    public let round: Int
    public let speaker: Speaker
    public let textEn: String
    public let textZh: String
    public let prompt: String?         // 用户应回答的引导语（可空）
    public let hint: String?           // 中文提示
    public let keyWords: [String]?     // 重点词

    enum CodingKeys: String, CodingKey {
        case round, speaker
        case textEn = "text_en"
        case textZh = "text_zh"
        case prompt, hint
        case keyWords = "key_words"
    }

    /// content/dialogs 实际 JSON 格式（ai_message 系列字段）的解码 key
    private enum ContentKeys: String, CodingKey {
        case round
        case aiMessage = "ai_message"
        case aiMessageZh = "ai_message_zh"
        case expectedHint = "expected_user_response_hint"
        case keyPhrases = "key_phrases"
        case keyPhrasesAlt = "key_phapes"   // 个别文件的笔误 key，兼容
        case userExample = "user_response_example"
        // 新版内容结构（2026-10 上游新增的实战场景：GAP COO / 9Tide FOB）
        case aiPrompt = "ai_prompt"
        case aiPromptZh = "ai_prompt_zh"
        case targetConcept = "target_concept"
        case referenceResponse = "reference_response"
        case keywords = "keywords"
    }

    /// 自定义解码：同时兼容两种格式，公开字段不变
    /// 1. 后端协议格式：speaker / text_en / text_zh / prompt / hint / key_words
    /// 2. Bundle 内容格式（72 个场景 JSON 实际格式）：每轮 = 客户先说(ai_message)，用户再答
    ///    - speaker 固定为 .partner，textEn/textZh 取 ai_message(_zh)
    ///    - prompt 取 user_response_example（参考答案），hint 取 expected_user_response_hint
    ///    - keyWords 取 key_phrases
    /// 3. 新版内容格式（2026-10 实战场景）：ai_prompt / target_concept / reference_response / keywords
    ///    - textEn 取 ai_prompt，textZh 取 ai_prompt_zh（缺失时留空）
    ///    - hint 取 target_concept，prompt 取 reference_response，keyWords 取 keywords
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.round = try c.decode(Int.self, forKey: .round)
        if let sp = try c.decodeIfPresent(Speaker.self, forKey: .speaker) {
            self.speaker = sp
            self.textEn = try c.decode(String.self, forKey: .textEn)
            self.textZh = try c.decode(String.self, forKey: .textZh)
            self.prompt = try c.decodeIfPresent(String.self, forKey: .prompt)
            self.hint = try c.decodeIfPresent(String.self, forKey: .hint)
            self.keyWords = try c.decodeIfPresent([String].self, forKey: .keyWords)
            return
        }
        let k = try decoder.container(keyedBy: ContentKeys.self)
        self.speaker = .partner
        if let m = try k.decodeIfPresent(String.self, forKey: .aiMessage) {
            self.textEn = m
        } else {
            self.textEn = try k.decode(String.self, forKey: .aiPrompt)
        }
        if let z = try k.decodeIfPresent(String.self, forKey: .aiMessageZh) {
            self.textZh = z
        } else {
            self.textZh = (try k.decodeIfPresent(String.self, forKey: .aiPromptZh)) ?? ""
        }
        self.prompt = (try k.decodeIfPresent(String.self, forKey: .userExample))
            ?? (try k.decodeIfPresent(String.self, forKey: .referenceResponse))
        self.hint = (try k.decodeIfPresent(String.self, forKey: .expectedHint))
            ?? (try k.decodeIfPresent(String.self, forKey: .targetConcept))
        if let phrases = try k.decodeIfPresent([String].self, forKey: .keyPhrases) {
            self.keyWords = phrases
        } else if let alt = try k.decodeIfPresent([String].self, forKey: .keyPhrasesAlt) {
            self.keyWords = alt
        } else {
            self.keyWords = try k.decodeIfPresent([String].self, forKey: .keywords)
        }
    }
}

public enum Speaker: String, Codable, Hashable {
    case user, partner, system
}

/// 完整场景对话 JSON 结构
public struct ScenarioDialog: Codable {
    public let scenarioId: String
    public let scenarioTitleZh: String
    public let scenarioTitleEn: String
    public let difficulty: String
    public let rounds: [DialogRound]

    enum CodingKeys: String, CodingKey {
        case scenarioId = "scenario_id"
        case scenarioTitleZh = "scenario_title_zh"
        case scenarioTitleEn = "scenario_title_en"
        case difficulty
        case rounds
    }

    /// 新版内容结构的兼容 key（2026-10 上游新增实战场景用的是 dialogue[] + title）
    private enum AltKeys: String, CodingKey {
        case title
        case dialogue
    }

    public init(
        scenarioId: String,
        scenarioTitleZh: String,
        scenarioTitleEn: String,
        difficulty: String,
        rounds: [DialogRound]
    ) {
        self.scenarioId = scenarioId
        self.scenarioTitleZh = scenarioTitleZh
        self.scenarioTitleEn = scenarioTitleEn
        self.difficulty = difficulty
        self.rounds = rounds
    }

    /// 自定义解码：兼容两套内容结构
    /// 1. 通用结构：scenario_title_zh / scenario_title_en / rounds[]
    /// 2. 新版结构：title / dialogue[]（上游 2026-10 新增的实战场景）
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let alt = try decoder.container(keyedBy: AltKeys.self)
        self.scenarioId = try c.decode(String.self, forKey: .scenarioId)
        self.difficulty = (try c.decodeIfPresent(String.self, forKey: .difficulty)) ?? "beginner"
        self.scenarioTitleZh = (try c.decodeIfPresent(String.self, forKey: .scenarioTitleZh))
            ?? (try alt.decodeIfPresent(String.self, forKey: .title))
            ?? ""
        self.scenarioTitleEn = (try c.decodeIfPresent(String.self, forKey: .scenarioTitleEn)) ?? ""
        if let r = try c.decodeIfPresent([DialogRound].self, forKey: .rounds) {
            self.rounds = r
        } else {
            self.rounds = try alt.decode([DialogRound].self, forKey: .dialogue)
        }
    }
}

// MARK: - Wordbook / Vocabulary

/// 生词本条目（对应后端 vocabulary_progress 表）
public struct VocabularyItem: Codable, Identifiable, Hashable {
    public var id: String { word }
    public let word: String
    public let phonetic: String?
    public let partOfSpeech: String?
    public let definitionEn: String?
    public let definitionZh: String?
    public let example: String?
    public let addedAt: Date
    public var reviewCount: Int
    public var lastReviewedAt: Date?
    public var difficulty: Int          // 0-5 自评难度

    enum CodingKeys: String, CodingKey {
        case word, phonetic
        case partOfSpeech = "part_of_speech"
        case definitionEn = "definition_en"
        case definitionZh = "definition_zh"
        case example
        case addedAt = "added_at"
        case reviewCount = "review_count"
        case lastReviewedAt = "last_reviewed_at"
        case difficulty
    }

    /// 公开构造器（App 端"加入生词本"用；默认值适配新手动添加场景）
    public init(word: String,
                phonetic: String? = nil,
                partOfSpeech: String? = nil,
                definitionEn: String? = nil,
                definitionZh: String? = nil,
                example: String? = nil,
                addedAt: Date = Date(),
                reviewCount: Int = 0,
                lastReviewedAt: Date? = nil,
                difficulty: Int = 1) {
        self.word = word
        self.phonetic = phonetic
        self.partOfSpeech = partOfSpeech
        self.definitionEn = definitionEn
        self.definitionZh = definitionZh
        self.example = example
        self.addedAt = addedAt
        self.reviewCount = reviewCount
        self.lastReviewedAt = lastReviewedAt
        self.difficulty = difficulty
    }
}

// MARK: - Session / History

/// 一次练习会话（对应后端 sessions 表）
public struct PracticeSession: Codable, Identifiable, Hashable {
    public let id: String
    public let scenarioId: String
    public let difficulty: String
    public let startedAt: Date
    public let endedAt: Date?
    public let totalRounds: Int
    public let avgScore: Double?
    public let userToken: String        // = identifierForVendor 或 Keychain UUID

    enum CodingKeys: String, CodingKey {
        case id
        case scenarioId = "scenario_id"
        case difficulty
        case startedAt = "started_at"
        case endedAt = "ended_at"
        case totalRounds = "total_rounds"
        case avgScore = "avg_score"
        case userToken = "user_token"
    }
}

/// WebSocket 实时消息（与后端 ws/session/:id 协议对齐）
public enum WSServerMessage: Codable {
    case partnerText(text: String, round: Int)
    case score(score: Double, feedback: String, raw: String?)
    case sessionEnd
    case error(message: String)

    enum CodingKeys: String, CodingKey {
        case type, text, round, score, feedback, raw, message
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(String.self, forKey: .type)
        switch type {
        case "partner_text":
            self = .partnerText(text: try c.decode(String.self, forKey: .text),
                                round: try c.decode(Int.self, forKey: .round))
        case "score":
            self = .score(score: try c.decode(Double.self, forKey: .score),
                          feedback: try c.decode(String.self, forKey: .feedback),
                          raw: try c.decodeIfPresent(String.self, forKey: .raw))
        case "session_end":
            self = .sessionEnd
        case "error":
            self = .error(message: try c.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "unknown type \(type)")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .partnerText(let text, let round):
            try c.encode("partner_text", forKey: .type)
            try c.encode(text, forKey: .text)
            try c.encode(round, forKey: .round)
        case .score(let score, let feedback, let raw):
            try c.encode("score", forKey: .type)
            try c.encode(score, forKey: .score)
            try c.encode(feedback, forKey: .feedback)
            try c.encodeIfPresent(raw, forKey: .raw)
        case .sessionEnd:
            try c.encode("session_end", forKey: .type)
        case .error(let message):
            try c.encode("error", forKey: .type)
            try c.encode(message, forKey: .message)
        }
    }
}

/// 用户发送给后端的 WS 消息
public struct WSClientMessage: Codable {
    public let type: String             // "user_audio" | "user_text" | "end_round"
    public let audioBase64: String?     // for user_audio
    public let text: String?            // for user_text
    public let round: Int?

    public init(audioBase64: String, round: Int) {
        self.type = "user_audio"
        self.audioBase64 = audioBase64
        self.text = nil
        self.round = round
    }

    public init(text: String, round: Int) {
        self.type = "user_text"
        self.audioBase64 = nil
        self.text = text
        self.round = round
    }

    public static func endRound(_ round: Int) -> WSClientMessage {
        .init(endRound: round)
    }

    private init(endRound: Int) {
        self.type = "end_round"
        self.audioBase64 = nil
        self.text = nil
        self.round = endRound
    }
}