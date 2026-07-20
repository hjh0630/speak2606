import Foundation
import AVFoundation
import Speech

// MARK: - TTS（系统原生，免费离线）

/// 语音合成服务 - 基于 AVSpeechSynthesizer
/// 优势：免费、离线、零 API key、延迟 < 50ms
@MainActor
public final class TTSService: NSObject {
    public static let shared = TTSService()

    private let synth = AVSpeechSynthesizer()
    public private(set) var isSpeaking = false

    /// 说出英文文本
    /// - Parameters:
    ///   - text: 要朗读的英文
    ///   - voice: 默认 "en-US"（支持 zh-CN 切中文）
    ///   - rate: 语速 0.0~1.0，默认 0.5（正常语速）
    public func speak(_ text: String, voice: String = "en-US", rate: Float = 0.5) {
        if synth.isPaused { synth.continueSpeaking() }
        if synth.isSpeaking {
            synth.stopSpeaking(at: .immediate)
        }
        let av = AVSpeechUtterance(string: text)
        av.voice = AVSpeechSynthesisVoice(language: voice)
        av.rate = rate
        av.pitchMultiplier = 1.0
        av.volume = 1.0
        isSpeaking = true
        synth.delegate = self
        synth.speak(av)
    }

    /// 停止当前播放
    public func stop() {
        synth.stopSpeaking(at: .immediate)
        isSpeaking = false
    }
}

extension TTSService: AVSpeechSynthesizerDelegate {
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                  didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
    }
    public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                                  didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.isSpeaking = false }
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