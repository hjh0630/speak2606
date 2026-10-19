import Foundation
import AVFoundation
import Speech

// MARK: - TTS（优先后端 MiniMax，离线回退系统原生）

/// 语音合成服务
/// - 在线时调用后端 /api/tts（MiniMax 大模型音色，支持男/女选择）
/// - 离线/失败时回退到系统 AVSpeechSynthesizer
@MainActor
public final class TTSService: NSObject {
    public static let shared = TTSService()

    private let synth = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    public private(set) var isSpeaking = false

    /// 说出英文文本
    /// - Parameters:
    ///   - text: 要朗读的英文
    ///   - language: 本地回退时使用的语言，默认 "en-US"
    ///   - rate: 本地回退时的语速 0.0~1.0，默认 0.9
    public func speak(_ text: String, language: String = "en-US", rate: Float = 0.9) {
        stopCurrentPlayback()

        // AI 朗读时配上舒缓伴音
        BackgroundMusicService.shared.playAlongsideTTS()

        // 优先走后端 MiniMax TTS（支持用户在「我的」里选的大模型音色）
        Task {
            do {
                let result = try await APIClient.shared.synthesize(
                    text: text,
                    voiceId: UserProfileStore.shared.voiceId,
                    speed: Double(rate)
                )
                await playRemoteAudio(result.audio, mime: result.mime)
            } catch {
                // 后端不可用或 mock，回退本地系统 TTS
                await playLocalTTS(text: text, language: language, rate: rate)
            }
        }
    }

    /// 获取指定语言下所有可用的系统原生音色（本地回退用）
    public static func availableLocalVoices(language: String = "en-US") -> [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language == language }
            .sorted { $0.name < $1.name }
    }

    /// 停止当前播放
    public func stop() {
        stopCurrentPlayback()
        BackgroundMusicService.shared.stopAfterTTS()
    }

    // MARK: - 私有

    private func stopCurrentPlayback() {
        audioPlayer?.stop()
        audioPlayer = nil
        synth.stopSpeaking(at: .immediate)
    }

    private func playRemoteAudio(_ data: Data, mime: String) {
        // 统一用 .playback，忽略静音开关，确保 TTS 清晰
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
        try? session.setActive(true)

        do {
            let player = try AVAudioPlayer(data: data)
            player.volume = 1.0
            player.delegate = self
            self.audioPlayer = player
            player.prepareToPlay()
            isSpeaking = player.play()
        } catch {
            isSpeaking = false
            BackgroundMusicService.shared.stopAfterTTS()
        }
    }

    private func playLocalTTS(text: String, language: String, rate: Float) {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .voicePrompt, options: [.duckOthers])
        try? session.setActive(true)

        let av = AVSpeechUtterance(string: text)
        av.voice = AVSpeechSynthesisVoice(language: language)
        av.rate = rate
        av.pitchMultiplier = 1.0
        av.volume = 1.0
        isSpeaking = true
        synth.delegate = self
        synth.speak(av)
    }
}

extension TTSService: AVAudioPlayerDelegate {
    public func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        isSpeaking = false
        BackgroundMusicService.shared.stopAfterTTS()
    }
}

extension TTSService: AVSpeechSynthesizerDelegate {
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                  didFinish utterance: AVSpeechUtterance) {
        isSpeaking = false
        BackgroundMusicService.shared.stopAfterTTS()
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                  didCancel utterance: AVSpeechUtterance) {
        isSpeaking = false
        BackgroundMusicService.shared.stopAfterTTS()
    }
}

// MARK: - ASR（系统原生，设备端识别，免费）

/// 实时语音识别服务 - 基于 SFSpeechRecognizer
/// 优势：免费、离线/在线混合、中英双语
@MainActor
public final class ASRService: NSObject {
    public static let shared = ASRService()

    private let recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()

    public var onPartialResult: ((String) -> Void)?
    public var onFinalResult: ((String) -> Void)?
    public var onError: ((Error) -> Void)?

    public init(locale: Locale = Locale(identifier: "en-US")) {
        self.recognizer = SFSpeechRecognizer(locale: locale) ?? SFSpeechRecognizer()
        super.init()
        self.recognizer?.delegate = self
    }

    /// 请求麦克风+语音识别权限（Info.plist 必须有 NSSpeechRecognitionUsageDescription + NSMicrophoneUsageDescription）
    public func requestAuthorization() async -> Bool {
        let speech = await withCheckedContinuation { (cont: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { status in cont.resume(returning: status) }
        }
        guard speech == .authorized else { return false }
        // 麦克风权限
        if #available(iOS 17.0, *) {
            return await AVAudioApplication.requestRecordPermission()
        } else {
            return await withCheckedContinuation { (cont: CheckedContinuation<Bool, Never>) in
                AVAudioSession.sharedInstance().requestRecordPermission { granted in cont.resume(returning: granted) }
            }
        }
    }

    /// 开始实时识别（持续识别直到 stop()）
    public func start() throws {
        try AVAudioSession.sharedInstance().setCategory(.playAndRecord,
                                                        mode: .measurement,
                                                        options: [.duckOthers, .defaultToSpeaker])
        try AVAudioSession.sharedInstance().setActive(true, options: .notifyOthersOnDeactivation)

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        self.request = req

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        // 输入格式无效时(模拟器无音频输入设备,采样率/声道为 0),
        // installTap 会抛 NSException —— 那不是 Swift Error,do-catch 接不住,直接闪退。
        // 必须先在这里拦住,转成可捕获的 Swift 错误。
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NSError(domain: "ASR", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "音频输入不可用:当前设备/模拟器没有麦克风输入"])
        }
        // 防御:重复 start 或上次 stop 未清理干净时,已有 tap 的节点再 installTap 同样抛 NSException
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        audioEngine.prepare()
        try audioEngine.start()

        task = recognizer?.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                if result.isFinal {
                    self.onFinalResult?(result.bestTranscription.formattedString)
                } else {
                    self.onPartialResult?(result.bestTranscription.formattedString)
                }
            }
            if let error {
                self.onError?(error)
                self.stop()
            }
        }
    }

    /// 停止识别
    public func stop() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

extension ASRService: SFSpeechRecognizerDelegate {
    public func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer,
                                 availabilityDidChange available: Bool) {
        if !available { onError?(NSError(domain: "ASR", code: -1, userInfo: [NSLocalizedDescriptionKey: "识别服务不可用"])) }
    }
}