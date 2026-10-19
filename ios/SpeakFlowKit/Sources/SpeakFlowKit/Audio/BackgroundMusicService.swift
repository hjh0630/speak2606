import Foundation
import AVFoundation
import Combine
import UIKit

/// AI 朗读时的舒缓配乐服务
/// - 平时不播放，只在 AI 说话（TTS）期间作为伴音淡入
/// - AI 说完后淡出停止
/// - 用户可在「我的」里开关
@MainActor
public final class BackgroundMusicService: ObservableObject {
    public static let shared = BackgroundMusicService()

    private var player: AVAudioPlayer?
    private var fadeTimer: Timer?

    /// 是否启用 AI 伴音（持久化到 UserDefaults，默认开启）
    @Published public var isEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isEnabled, forKey: "htalk.backgroundMusicEnabled")
            if !isEnabled {
                stop()
            }
        }
    }

    /// 当前是否正在播放伴音
    @Published public private(set) var isPlaying = false

    private init() {
        self.isEnabled = UserDefaults.standard.object(forKey: "htalk.backgroundMusicEnabled") as? Bool ?? true
        configureAudioSession()
        preparePlayer()
    }

    // MARK: - 公开接口

    /// AI 开始朗读时调用：淡入伴音
    public func playAlongsideTTS() {
        guard isEnabled else { return }
        fadeTimer?.invalidate()
        preparePlayer()
        player?.currentTime = 0
        player?.volume = 0.0
        player?.play()
        isPlaying = true
        fadeVolume(to: 0.18, duration: 0.8)
    }

    /// AI 朗读结束或被打断时调用：淡出并停止
    public func stopAfterTTS() {
        guard isPlaying else { return }
        fadeVolume(to: 0.0, duration: 0.6) { [weak self] in
            self?.player?.stop()
            self?.isPlaying = false
        }
    }

    /// 立即停止（切换开关或退出练习时）
    public func stop() {
        fadeTimer?.invalidate()
        fadeTimer = nil
        player?.stop()
        isPlaying = false
    }

    // MARK: - 私有

    private func configureAudioSession() {
        // ambient: 不会打断其他 App 音乐，会随静音开关静音
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
    }

    private func preparePlayer() {
        guard player == nil else { return }
        // 优先从 Assets.xcassets (Data Set) 加载
        if let asset = NSDataAsset(name: "ambient_bg", bundle: Bundle.main) {
            setupPlayer(data: asset.data)
            return
        }
        // 兼容 App Bundle 根目录的 wav
        if let url = Bundle.main.url(forResource: "ambient_bg", withExtension: "wav") {
            setupPlayer(url: url)
            return
        }
        print("BGM 资源未找到")
    }

    private func setupPlayer(data: Data) {
        do {
            let p = try AVAudioPlayer(data: data)
            p.numberOfLoops = -1
            p.volume = 0.0
            p.prepareToPlay()
            self.player = p
        } catch {
            print("BGM 初始化失败: \(error.localizedDescription)")
        }
    }

    private func setupPlayer(url: URL) {
        do {
            let p = try AVAudioPlayer(contentsOf: url)
            p.numberOfLoops = -1
            p.volume = 0.0
            p.prepareToPlay()
            self.player = p
        } catch {
            print("BGM 初始化失败: \(error.localizedDescription)")
        }
    }

    private func fadeVolume(to target: Float, duration: TimeInterval, completion: (() -> Void)? = nil) {
        fadeTimer?.invalidate()
        guard let player = player else {
            completion?()
            return
        }
        let start = player.volume
        let steps = max(1, Int(duration / 0.02))
        var current = 0
        fadeTimer = Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { [weak self] timer in
            guard let self = self else { timer.invalidate(); return }
            current += 1
            let progress = Float(current) / Float(steps)
            player.volume = start + (target - start) * progress
            if current >= steps {
                timer.invalidate()
                self.fadeTimer = nil
                player.volume = target
                completion?()
            }
        }
    }
}
