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
    public func fetchScenarios() async throws -> [Scenario] {
        try await get("/api/scenarios")
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

    public var errorDescription: String? {
        switch self {
        case .invalidResponse: return "无效响应"
        case .httpError(let s): return "HTTP \(s)"
        case .decodingFailed(let e): return "解析失败: \(e.localizedDescription)"
        }
    }
}

/// 词典条目（与 /api/dictionary 响应字段对齐）
public struct DictionaryEntry: Codable, Hashable {
    public let word: String
    public let phonetic: String?
    public let partOfSpeech: String?
    public let definitionEn: String?
    public let definitionZh: String?
    public let example: String?
    public let source: String           // "local" / "llm" / "mock"
}