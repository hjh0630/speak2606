import Foundation

/// 用户本地资料与 Token 使用累计（全部存在 UserDefaults，不上传）
@MainActor
public final class UserProfileStore: ObservableObject {
    public static let shared = UserProfileStore()

    private let defaults = UserDefaults.standard
    private enum Keys {
        static let userName = "htalk.userName"
        static let avatarEmoji = "htalk.avatarEmoji"
        static let tokenUsage = "htalk.tokenUsage"
        static let voiceId = "htalk.voiceId"
    }

    @Published public private(set) var userName: String {
        didSet { defaults.set(userName, forKey: Keys.userName) }
    }

    @Published public private(set) var avatarEmoji: String {
        didSet { defaults.set(avatarEmoji, forKey: Keys.avatarEmoji) }
    }

    @Published public private(set) var tokenUsage: Int {
        didSet { defaults.set(tokenUsage, forKey: Keys.tokenUsage) }
    }

    /// 选中的后端 MiniMax TTS 音色 ID；nil 表示使用后端默认音色
    @Published public private(set) var voiceId: String? {
        didSet { defaults.set(voiceId, forKey: Keys.voiceId) }
    }

    public init() {
        self.userName = defaults.string(forKey: Keys.userName) ?? "David"
        self.avatarEmoji = defaults.string(forKey: Keys.avatarEmoji) ?? "👤"
        self.tokenUsage = defaults.integer(forKey: Keys.tokenUsage)
        let stored = defaults.string(forKey: Keys.voiceId)
        self.voiceId = (stored?.isEmpty == false) ? stored : nil
    }

    public func setUserName(_ name: String) {
        userName = name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "David"
            : name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public func setAvatarEmoji(_ emoji: String) {
        avatarEmoji = emoji.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "👤"
            : emoji.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// 累计 Token：每完成一轮口语练习，按固定估值累加
    public func addTokens(_ count: Int) {
        tokenUsage += max(0, count)
    }

    public func setVoiceId(_ id: String?) {
        voiceId = (id?.isEmpty == false) ? id : nil
    }
}
