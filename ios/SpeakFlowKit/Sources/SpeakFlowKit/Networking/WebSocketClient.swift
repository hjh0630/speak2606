import Foundation

/// 实时对话 WebSocket 客户端
/// - 端点：wss://speakflow-api.hjinghui.workers.dev/ws/session/:id
/// - 协议：JSON 文本帧（前后端已统一，见 Models.swift 的 WSServerMessage / WSClientMessage）
public final class WebSocketClient: NSObject {
    public typealias ServerMessageHandler = (WSServerMessage) -> Void

    private let baseURL: URL
    private var task: URLSessionWebSocketTask?
    private lazy var session = URLSession(configuration: .default, delegate: self, delegateQueue: .main)
    private var onMessage: ServerMessageHandler?

    public init(baseURL: URL = URL(string: "wss://speakflow-api.hjinghui.workers.dev")!) {
        self.baseURL = baseURL
    }

    /// 连接到指定会话
    public func connect(sessionId: String, onMessage: @escaping ServerMessageHandler) {
        self.onMessage = onMessage
        let url = baseURL.appendingPathComponent("/ws/session/\(sessionId)")
        task = session.webSocketTask(with: url)
        task?.resume()
        listen()
    }

    /// 发送用户音频或文本
    public func send(_ message: WSClientMessage) async throws {
        let data = try JSONEncoder().encode(message)
        guard let json = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "WebSocketClient", code: -1, userInfo: [NSLocalizedDescriptionKey: "JSON encode failed"])
        }
        try await task?.send(.string(json))
    }

    /// 主动断开
    public func disconnect() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
    }

    /// 持续监听（递归）
    private func listen() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let err):
                self.onMessage?(.error(message: err.localizedDescription))
            case .success(let msg):
                switch msg {
                case .string(let str):
                    self.handleText(str)
                case .data(let data):
                    if let str = String(data: data, encoding: .utf8) { self.handleText(str) }
                @unknown default: break
                }
                self.listen()  // 继续下一帧
            }
        }
    }

    private func handleText(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }
        do {
            let msg = try JSONDecoder().decode(WSServerMessage.self, from: data)
            onMessage?(msg)
        } catch {
            onMessage?(.error(message: "解析失败: \(error.localizedDescription)"))
        }
    }
}

extension WebSocketClient: URLSessionWebSocketDelegate {
    public func urlSession(_ session: URLSession,
                           webSocketTask: URLSessionWebSocketTask,
                           didOpenWithProtocol protocol: String?) {
        // 连接成功；可在 onMessage 里加 .connected 类型（暂用隐式）
    }

    public func urlSession(_ session: URLSession,
                           webSocketTask: URLSessionWebSocketTask,
                           didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
                           reason: Data?) {
        onMessage?(.error(message: "连接关闭 (code=\(closeCode.rawValue))"))
    }
}