import Foundation

/// SpeakFlow API 客户端
/// - 后端：Cloudflare Workers (speakflow-api.hjinghui.workers.dev)
/// - 协议：HTTPS + WebSocket
/// - 安全：所有 secret 在后端，iOS 端无 key
public actor APIClient {
    public static let shared = APIClient(baseURL: URL(string: "https://speakflow-api.hjinghui.workers.dev")!)

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: - Endpoints

    /// 26 个场景元数据（与 /api/scenarios 对齐）
    /// 后端返回 `{ "items": [...], "count": N }`，取 items 数组。
    public func fetchScenarios() async throws -> [Scenario] {
        struct ScenariosResponse: Decodable { let items: [Scenario] }
        let response: ScenariosResponse = try await get("/api/scenarios")
        return response.items
    }

    /// 词典查词（与 /api/dictionary 对齐，含 LLM fallback）
    public func lookupWord(_ word: String) async throws -> DictionaryEntry {
        var comps = URLComponents(url: baseURL.appendingPathComponent("/api/dictionary"),
                                  resolvingAgainstBaseURL: false)!
        comps.queryItems = [URLQueryItem(name: "w", value: word)]
        let (data, resp) = try await session.data(from: comps.url!)
        try Self.validate(resp)
        return try decoder.decode(DictionaryEntry.self, from: data)
    }

    /// 历史会话列表
    public func fetchHistory(userToken: String, limit: Int = 50) async throws -> [PracticeSession] {
        try await get("/api/history", query: [URLQueryItem(name: "user_token", value: userToken),
                                              URLQueryItem(name: "limit", value: "\(limit)")])
    }

    /// 健康检查
    public func health() async throws -> Bool {
        let (data, resp) = try await session.data(from: baseURL.appendingPathComponent("/health"))
        try Self.validate(resp)
        struct R: Decodable { let ok: Bool }
        return (try? JSONDecoder().decode(R.self, from: data))?.ok ?? false
    }

    /// 获取后端可用的 MiniMax TTS 音色列表
    public func fetchVoices() async throws -> [TTSVoice] {
        struct R: Decodable { let voices: [TTSVoice] }
        let response: R = try await get("/api/tts/voices", query: [])
        return response.voices
    }

    /// 调用后端 TTS 合成音频
    /// - Returns: 音频 Data 与 MIME 类型
    public func synthesize(text: String, voiceId: String?, speed: Double = 1.0) async throws -> TTSResult {
        struct Body: Encodable {
            let text: String
            let voice_id: String?
            let speed: Double
        }
        struct R: Decodable {
            let mocked: Bool
            let audio_base64: String
            let mime: String?
            let note: String?
        }
        let body = Body(text: text, voice_id: voiceId, speed: speed)
        let payload = try encoder.encode(body)
        var req = URLRequest(url: baseURL.appendingPathComponent("/api/tts"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = payload
        let (data, resp) = try await session.data(for: req)
        try Self.validate(resp)
        let r = try decoder.decode(R.self, from: data)
        if r.mocked, let note = r.note {
            throw APIError.ttsMocked(note: note)
        }
        guard let audio = Data(base64Encoded: r.audio_base64) else {
            throw APIError.decodingFailed(NSError(domain: "TTS", code: -1, userInfo: [NSLocalizedDescriptionKey: "音频 base64 解码失败"]))
        }
        return TTSResult(audio: audio, mime: r.mime ?? "audio/mpeg")
    }

    // MARK: - Helpers

    private func get<T: Decodable>(_ path: String, query: [URLQueryItem] = []) async throws -> T {
        var comps = URLComponents(url: baseURL.appendingPathComponent(path),
                                  resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        let (data, resp) = try await session.data(from: comps.url!)
        try Self.validate(resp)
        return try decoder.decode(T.self, from: data)
    }

    private static func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.httpError(status: http.statusCode)
        }
    }
}

public enum APIError: LocalizedError {
    case invalidResponse
    case httpError(status: Int)
    case decodingFailed(Error)
    case ttsMocked(note: String)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse: return "无效响应"
        case .httpError(let s): return "HTTP \(s)"
        case .decodingFailed(let e): return "解析失败: \(e.localizedDescription)"
        case .ttsMocked(let note): return "TTS 模拟模式: \(note)"
        }
    }
}

/// 后端 TTS 音色
public struct TTSVoice: Codable, Identifiable, Hashable {
    public let id: String
    public let name: String
    public let gender: String
}

extension TTSVoice {
    /// 本地兜底音色列表（当 Workers 尚未部署 /api/tts/voices 或网络失败时使用）
    /// 这些 ID 已在 MiniMax 后端验证可用。
    public static let fallbackVoices: [TTSVoice] = [
        TTSVoice(id: "male-qn-qingse", name: "男生 · 清澈", gender: "male"),
        TTSVoice(id: "male-qn-badao", name: "男生 · 霸道", gender: "male"),
        TTSVoice(id: "male-qn-daxuesheng", name: "男生 · 年轻", gender: "male"),
        TTSVoice(id: "female-shaonv", name: "女生 · 少女", gender: "female"),
        TTSVoice(id: "female-yujie", name: "女生 · 成熟", gender: "female"),
        TTSVoice(id: "female-chengshu", name: "女生 · 知性", gender: "female"),
        TTSVoice(id: "female-tianmei", name: "女生 · 甜美", gender: "female"),
    ]
}

/// 后端 TTS 合成结果
public struct TTSResult {
    public let audio: Data
    public let mime: String
}

/// 词典条目（与 /api/dictionary 响应字段对齐）
public struct DictionaryEntry: Codable, Hashable {
    public let word: String
    public let phonetic: String?
    public let partOfSpeech: String?
    public let definitionEn: String?
    public let definitionZh: String?
    public let example: String?
    public let source: String           // "local" / "llm" / "mock" / "scenario" / "vocabulary"

    public init(word: String,
                phonetic: String? = nil,
                partOfSpeech: String? = nil,
                definitionEn: String? = nil,
                definitionZh: String? = nil,
                example: String? = nil,
                source: String = "local") {
        self.word = word
        self.phonetic = phonetic
        self.partOfSpeech = partOfSpeech
        self.definitionEn = definitionEn
        self.definitionZh = definitionZh
        self.example = example
        self.source = source
    }
}