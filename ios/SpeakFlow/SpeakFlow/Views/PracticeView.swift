import SwiftUI
import SpeakFlowKit
import AVFoundation

/// 练习页（iPhone 15 Pro 专属人机工程学优化版）
/// - 视口基准：393 × 852 pt，顶部适配灵动岛安全区，底部沉浸式单手悬浮操作栏
/// - 核心交互：客户气泡（MiniMax / 系统 TTS 朗读）→ 用户开口应答（ASR 原生转写）
///           → 【💡 Native Polish 母语地道重述】黄金重塑卡片 → 一键母语发音示范与影子跟读
struct PracticeView: View {
    let scenarioId: String
    let difficulty: String
    let scenarioTitle: String

    @Environment(\.dismiss) private var dismiss

    @State private var dialog: ScenarioDialog?
    @State private var loadError: String?
    @State private var currentIndex: Int = 0
    @State private var showTranslation: Bool = false
    @State private var showReference: Bool = false
    @State private var isRecording: Bool = false
    @State private var partialText: String = ""
    @State private var recognizedText: String = ""
    @State private var roundScore: Int?
    @State private var scores: [Int] = []
    @State private var isFinished: Bool = false
    @State private var micDenied: Bool = false

    // 录音按键呼吸光晕动画
    @State private var isPulsing: Bool = false

    // 点词查词浮层
    @State private var lookupEntry: DictionaryEntry?
    @State private var showLookupSheet: Bool = false
    @State private var lookupError: String?
    @State private var lookupAdded: Bool = false
    @State private var isLookingUp: Bool = false

    private var rounds: [DialogRound] { dialog?.rounds ?? [] }
    private var currentRound: DialogRound? {
        guard currentIndex >= 0, currentIndex < rounds.count else { return nil }
        return rounds[currentIndex]
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            // 主体滚动内容区
            VStack(spacing: 0) {
                if !rounds.isEmpty && !isFinished {
                    topProgressHeader
                }

                if isFinished {
                    finishedPage
                } else if let error = loadError {
                    ContentErrorView(message: error)
                } else if dialog == nil {
                    ProgressView("正在加载实战剧本…")
                        .frame(maxHeight: .infinity)
                } else if let round = currentRound {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 14) {
                                if round.speaker == .system {
                                    systemBubble(round)
                                } else {
                                    if !round.textEn.isEmpty {
                                        partnerBubble(round)
                                    }
                                    if needsUserReply(round) {
                                        userPromptCard(round)
                                        
                                        // 识别结果与母语重述卡片
                                        if roundScore != nil || !recognizedText.isEmpty {
                                            nativePolishCard(round)
                                                .id("polishCard")
                                        }
                                    }
                                }

                                // 底部留白，确保不被 iPhone 15 Pro 悬浮 Dock 遮挡
                                Color.clear.frame(height: 140)
                            }
                            .padding(.horizontal, 16)
                            .padding(.top, 12)
                        }
                        .onChange(of: roundScore) { _, newScore in
                            if newScore != nil {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                    proxy.scrollTo("polishCard", anchor: .bottom)
                                }
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemGroupedBackground))

            // iPhone 15 Pro 专属：底部拇指操作 Dock
            if !isFinished && currentRound != nil && dialog != nil {
                if let round = currentRound, needsUserReply(round) {
                    bottomFloatingDock(round)
                } else {
                    bottomContinueDock
                }
            }
        }
        .navigationTitle(scenarioTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { loadDialog() }
        .onDisappear {
            TTSService.shared.stop()
            ASRService.shared.stop()
        }
        .overlay(alignment: .center) {
            if showLookupSheet, let entry = lookupEntry {
                wordLookupPopup(entry)
            }
        }
    }

    // MARK: - 顶部进度指示 (适配 iPhone 15 Pro 灵动岛下方区域)

    private var topProgressHeader: some View {
        HStack(spacing: 12) {
            ProgressView(value: Double(currentIndex + 1), total: Double(rounds.count))
                .tint(Color.kleinBlue)
            Text("\(currentIndex + 1)/\(rounds.count)")
                .font(.system(.caption, design: .monospaced).bold())
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemGroupedBackground))
    }

    // MARK: - 客户发言气泡

    private func partnerBubble(_ round: DialogRound) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.kleinBlue.opacity(0.15))
                    .frame(width: 24, height: 24)
                    .overlay {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 14))
                            .foregroundStyle(Color.kleinBlue)
                    }
                Text("客商 / 材料专家")
                    .font(.caption.bold())
                    .foregroundStyle(Color.kleinBlue)

                Spacer()

                Button {
                    triggerHaptic()
                    TTSService.shared.speak(round.textEn)
                } label: {
                    Label("重播", systemImage: "speaker.wave.2.fill")
                        .font(.caption.bold())
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.kleinBlue.opacity(0.08))
                        .clipShape(Capsule())
                }
            }

            // 逐词可点查的英文文本
            tappableEnglishText(round.textEn)

            // 中文翻译折叠器
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    showTranslation.toggle()
                }
            } label: {
                HStack(spacing: 4) {
                    Text(showTranslation ? "收起中文参考" : "查看中文含义")
                        .font(.caption)
                    Image(systemName: showTranslation ? "chevron.up" : "chevron.down")
                        .font(.system(size: 10))
                }
                .foregroundStyle(.secondary)
            }

            if showTranslation {
                Text(round.textZh)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.top, 2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: .black.opacity(0.03), radius: 6, x: 0, y: 2)
    }

    // MARK: - 用户提示与行话备选卡

    private func userPromptCard(_ round: DialogRound) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("你的实战任务", systemImage: "target")
                    .font(.caption.bold())
                    .foregroundStyle(.orange)
                Spacer()
                if let ref = round.prompt, !ref.isEmpty {
                    Button(showReference ? "收起母语参考" : "偷看参考") {
                        withAnimation { showReference.toggle() }
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }

            if let hint = round.hint, !hint.isEmpty {
                Text(hint)
                    .font(.subheadline.bold())
                    .foregroundStyle(Color(.label))
            }

            if let keyWords = round.keyWords, !keyWords.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("💡 行业高频地道语块 (Collocations):")
                        .font(.caption2.bold())
                        .foregroundStyle(.secondary)
                    FlowLayout(spacing: 6) {
                        ForEach(keyWords, id: \.self) { kw in
                            Text(kw)
                                .font(.caption.bold())
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.orange.opacity(0.1))
                                .foregroundStyle(.orange)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }
                .padding(.top, 2)
            }

            if showReference, let ref = round.prompt {
                Text("“\(ref)”")
                    .font(.callout.italic())
                    .foregroundStyle(Color.kleinBlue)
                    .padding(10)
                    .background(Color.kleinBlue.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - 【💡 Native Polish 母语地道重述】黄金核心重构卡片

    private func nativePolishCard(_ round: DialogRound) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("母语老兵地道重构 (Native Polish)", systemImage: "sparkles")
                    .font(.subheadline.bold())
                    .foregroundStyle(Color.emeraldGreen)

                Spacer()

                if let score = roundScore {
                    Text("表达契合度 \(score)%")
                        .font(.caption.bold())
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(score >= 70 ? Color.green.opacity(0.15) : Color.orange.opacity(0.15))
                        .foregroundStyle(score >= 70 ? .green : .orange)
                        .clipShape(Capsule())
                }
            }

            // 用户自己的真实识别转写
            if !recognizedText.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("你的原话 (Your Speech):")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("“\(recognizedText)”")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.tertiarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            // 母语老外真正怎么说
            if let nativeText = round.prompt, !nativeText.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("欧美采购总监/技术总监这样说:")
                        .font(.caption.bold())
                        .foregroundStyle(Color.emeraldGreen)

                    Text(nativeText)
                        .font(.body.bold())
                        .foregroundStyle(Color(.label))
                        .lineSpacing(3)

                    HStack(spacing: 12) {
                        Button {
                            triggerHaptic()
                            TTSService.shared.speak(nativeText)
                        } label: {
                            Label("听母语示范", systemImage: "speaker.wave.3.fill")
                                .font(.caption.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.emeraldGreen.opacity(0.15))
                                .foregroundStyle(Color.emeraldGreen)
                                .clipShape(Capsule())
                        }

                        Button {
                            triggerHaptic()
                            retryRound()
                            toggleRecording()
                        } label: {
                            Label("影子跟读练习", systemImage: "mic.fill")
                                .font(.caption.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.orange.opacity(0.15))
                                .foregroundStyle(.orange)
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.top, 4)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemGroupedBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.emeraldGreen.opacity(0.35), lineWidth: 1.5)
                )
        )
        .shadow(color: Color.emeraldGreen.opacity(0.08), radius: 10, x: 0, y: 4)
    }

    // MARK: - iPhone 15 Pro 悬浮底部控制栏 (符合拇指热区与 Home Bar 安全区)

    private func bottomFloatingDock(_ round: DialogRound) -> some View {
        VStack(spacing: 0) {
            // 实时识别文字提示条
            if isRecording {
                Text(partialText.isEmpty ? "🎙️ 正在倾听… 请用英文作答" : partialText)
                    .font(.caption.bold())
                    .foregroundStyle(Color.kleinBlue)
                    .lineLimit(1)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 4)
                    .transition(.opacity)
            }

            HStack(alignment: .center, spacing: 20) {
                // 左侧：听原音/参考
                Button {
                    triggerHaptic()
                    if let ref = round.prompt {
                        TTSService.shared.speak(ref)
                    } else if !round.textEn.isEmpty {
                        TTSService.shared.speak(round.textEn)
                    }
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: "ear.badge.waveform")
                            .font(.system(size: 20, weight: .semibold))
                        Text("听示范")
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundStyle(Color(.label))
                    .frame(width: 58, height: 58)
                    .background(Color(.tertiarySystemGroupedBackground))
                    .clipShape(Circle())
                }

                // 中间：iPhone 15 Pro 专属 74pt 触觉录音主按钮
                Button {
                    triggerHaptic()
                    toggleRecording()
                } label: {
                    ZStack {
                        // 录音中的呼吸扩散光晕
                        if isRecording {
                            Circle()
                                .stroke(Color.red.opacity(0.35), lineWidth: 4)
                                .frame(width: 86, height: 86)
                                .scaleEffect(isPulsing ? 1.15 : 0.95)
                                .opacity(isPulsing ? 0.3 : 0.8)
                                .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: isPulsing)
                        }

                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: isRecording ? [Color.red, Color.red.opacity(0.85)] : [Color.kleinBlue, Color.kleinBlue.opacity(0.85)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 74, height: 74)
                            .shadow(color: isRecording ? Color.red.opacity(0.35) : Color.kleinBlue.opacity(0.35), radius: 10, x: 0, y: 5)

                        Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }

                // 右侧：继续 / 重说
                if roundScore != nil {
                    Button {
                        triggerHaptic()
                        advance()
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: isLastRound ? "checkmark" : "arrow.right")
                                .font(.system(size: 20, weight: .bold))
                            Text(isLastRound ? "完成" : "下一轮")
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .foregroundStyle(.white)
                        .frame(width: 58, height: 58)
                        .background(Color.emeraldGreen)
                        .clipShape(Circle())
                        .shadow(color: Color.emeraldGreen.opacity(0.3), radius: 6, x: 0, y: 3)
                    }
                } else {
                    Button {
                        triggerHaptic()
                        retryRound()
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: "arrow.counterclockwise")
                                .font(.system(size: 20, weight: .semibold))
                            Text("重说")
                                .font(.system(size: 11, weight: .medium))
                        }
                        .foregroundStyle(.secondary)
                        .frame(width: 58, height: 58)
                        .background(Color(.tertiarySystemGroupedBackground))
                        .clipShape(Circle())
                    }
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24) // 适配 iPhone 15 Pro Home Bar 底部安全距离
        }
        .frame(maxWidth: .infinity)
        .background(
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(
                    Rectangle()
                        .frame(height: 0.5)
                        .foregroundStyle(Color(.separator).opacity(0.3)),
                    alignment: .top
                )
        )
    }

    private var bottomContinueDock: some View {
        VStack(spacing: 0) {
            Button {
                triggerHaptic()
                advance()
            } label: {
                Text(isLastRound ? "完成实战" : "继续下一轮")
                    .font(.body.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(Color.kleinBlue)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .padding(.horizontal, 24)
            }
            .padding(.top, 12)
            .padding(.bottom, 28)
        }
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
    }

    // MARK: - 辅助方法与分词点查

    private func triggerHaptic() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    private func tappableEnglishText(_ text: String) -> some View {
        FlowLayout(spacing: 5) {
            ForEach(wordTokens(from: text), id: \.self) { token in
                if let word = cleanWord(token), !word.isEmpty {
                    Button {
                        lookupWord(word)
                    } label: {
                        Text(token)
                            .font(.system(.body, design: .default))
                            .foregroundStyle(Color(.label))
                            .underline(color: Color.kleinBlue.opacity(0.35))
                    }
                    .buttonStyle(.plain)
                } else {
                    Text(token)
                        .font(.system(.body, design: .default))
                        .foregroundStyle(Color(.label))
                }
            }
        }
    }

    private func wordTokens(from text: String) -> [String] {
        var tokens: [String] = []
        var current = ""
        for char in text {
            if char.isLetter || char == "'" || char == "-" {
                current.append(char)
            } else {
                if !current.isEmpty {
                    tokens.append(current)
                    current = ""
                }
                tokens.append(String(char))
            }
        }
        if !current.isEmpty { tokens.append(current) }
        return tokens
    }

    private func cleanWord(_ token: String) -> String? {
        let trimmed = token.trimmingCharacters(in: .punctuationCharacters)
        guard !trimmed.isEmpty, trimmed.allSatisfy({ $0.isLetter || $0 == "'" || $0 == "-" }) else {
            return nil
        }
        return trimmed.lowercased()
    }

    private func systemBubble(_ round: DialogRound) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(round.textZh.isEmpty ? round.textEn : round.textZh)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.tertiarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var isLastRound: Bool { currentIndex >= rounds.count - 1 }

    private func needsUserReply(_ round: DialogRound) -> Bool {
        if round.speaker == .user { return true }
        return round.prompt != nil || round.hint != nil || (round.keyWords?.isEmpty == false)
    }

    // MARK: - 结束页

    private var finishedPage: some View {
        VStack(spacing: 20) {
            Spacer()
            Circle()
                .fill(Color.emeraldGreen.opacity(0.15))
                .frame(width: 88, height: 88)
                .overlay {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.emeraldGreen)
                }

            Text("实战对话顺利完成！")
                .font(.title2.bold())

            Text("已完成本场景全流程技术交锋与母语重构")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            if !scores.isEmpty {
                let avg = scores.reduce(0, +) / scores.count
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("\(avg)")
                        .font(.system(size: 54, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.kleinBlue)
                    Text("分")
                        .font(.title3.bold())
                        .foregroundStyle(.secondary)
                }
            }

            Button {
                dismiss()
            } label: {
                Text("返回场景库")
                    .font(.body.bold())
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.kleinBlue)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .padding(.horizontal, 32)
            }
            .padding(.top, 12)

            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity)
    }

    // MARK: - 逻辑控制

    private func loadDialog() {
        do {
            dialog = try ScenarioLoader.loadDialog(scenarioId: scenarioId, difficulty: difficulty)
            startRound()
        } catch {
            loadError = "剧本加载失败：\(error.localizedDescription)"
        }
    }

    private func startRound() {
        showTranslation = false
        showReference = false
        partialText = ""
        recognizedText = ""
        roundScore = nil
        micDenied = false
        guard let round = currentRound else { return }
        if round.speaker == .partner, !round.textEn.isEmpty {
            TTSService.shared.speak(round.textEn)
        }
    }

    private func advance() {
        if let round = currentRound, needsUserReply(round) {
            scores.append(roundScore ?? 80)
            UserProfileStore.shared.addTokens(150)
        }
        TTSService.shared.stop()
        if isLastRound {
            isFinished = true
        } else {
            currentIndex += 1
            startRound()
        }
    }

    private func retryRound() {
        recognizedText = ""
        partialText = ""
        roundScore = nil
    }

    // MARK: - ASR 录音

    private func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            Task {
                let ok = await ASRService.shared.requestAuthorization()
                if ok {
                    startRecording()
                } else {
                    micDenied = true
                }
            }
        }
    }

    private func startRecording() {
        TTSService.shared.stop()
        let asr = ASRService.shared
        asr.onPartialResult = { text in
            Task { @MainActor in self.partialText = text }
        }
        asr.onFinalResult = { text in
            Task { @MainActor in
                self.recognizedText = text
                self.partialText = ""
            }
        }
        asr.onError = { _ in
            Task { @MainActor in self.isRecording = false }
        }
        do {
            try asr.start()
            partialText = ""
            recognizedText = ""
            isRecording = true
            isPulsing = true
        } catch {
            micDenied = true
        }
    }

    private func stopRecording() {
        ASRService.shared.stop()
        isRecording = false
        isPulsing = false
        if recognizedText.isEmpty { recognizedText = partialText }
        partialText = ""
        if let round = currentRound, !recognizedText.isEmpty {
            roundScore = Self.score(recognized: recognizedText, round: round)
        } else {
            roundScore = 75
        }
    }

    static func score(recognized: String, round: DialogRound) -> Int {
        let said = recognized.lowercased()
        var targets: [String] = []
        if let keyWords = round.keyWords, !keyWords.isEmpty {
            targets = keyWords.flatMap { tokenize($0) }
        } else if let reference = round.prompt {
            targets = tokenize(reference)
        } else {
            targets = tokenize(round.textEn)
        }
        let unique = Array(Set(targets.filter { $0.count > 1 }))
        guard !unique.isEmpty else { return 80 }
        let matched = unique.filter { said.contains($0) }.count
        return min(100, max(50, matched * 100 / unique.count))
    }

    private static func tokenize(_ text: String) -> [String] {
        text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
    }

    // MARK: - 点词查词

    private func lookupWord(_ word: String) {
        guard !isLookingUp else { return }
        isLookingUp = true
        lookupError = nil
        lookupAdded = false
        Task {
            do {
                let entry = try await APIClient.shared.lookupWord(word)
                await MainActor.run {
                    self.lookupEntry = entry
                    self.showLookupSheet = true
                    self.isLookingUp = false
                }
            } catch {
                let local = (try? ScenarioLoader.loadDictionary())?.first {
                    $0.word.lowercased() == word.lowercased()
                } ?? (try? ScenarioLoader.loadDictionary())?.first {
                    $0.word.lowercased().hasPrefix(word.lowercased())
                }
                await MainActor.run {
                    if let local {
                        self.lookupEntry = local
                    } else {
                        self.lookupEntry = DictionaryEntry(
                            word: word,
                            definitionZh: "未找到释义（请检查网络）",
                            source: "mock"
                        )
                    }
                    self.showLookupSheet = true
                    self.isLookingUp = false
                }
            }
        }
    }

    private func addToWordbook(_ entry: DictionaryEntry) {
        let item = VocabularyItem(
            word: entry.word,
            phonetic: entry.phonetic,
            partOfSpeech: entry.partOfSpeech,
            definitionEn: entry.definitionEn,
            definitionZh: entry.definitionZh,
            example: entry.example
        )
        do {
            try VocabularyStore.shared.add(item)
            lookupAdded = true
        } catch {
            lookupError = "加入生词本失败：\(error.localizedDescription)"
        }
    }

    private func wordLookupPopup(_ entry: DictionaryEntry) -> some View {
        ZStack {
            Color.black.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture { lookupEntry = nil }

            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(entry.word)
                        .font(.title2.bold())
                    if let phonetic = entry.phonetic, !phonetic.isEmpty {
                        Text(phonetic)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { lookupEntry = nil } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                }

                if let zh = entry.definitionZh, !zh.isEmpty {
                    Text(zh)
                        .font(.body)
                }

                HStack(spacing: 12) {
                    Button {
                        triggerHaptic()
                        TTSService.shared.speak(entry.word)
                    } label: {
                        Label("发音", systemImage: "speaker.wave.2.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.kleinBlue)

                    Button {
                        triggerHaptic()
                        addToWordbook(entry)
                    } label: {
                        Label(lookupAdded ? "已存" : "存入生词本",
                              systemImage: lookupAdded ? "checkmark.circle.fill" : "plus.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(lookupAdded)
                }
            }
            .padding(18)
            .frame(maxWidth: 330)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.2), radius: 24, x: 0, y: 10)
            .padding(.horizontal, 24)
        }
    }
}

// MARK: - 辅助组件

extension Color {
    static let emeraldGreen = Color(red: 16.0 / 255.0, green: 149.0 / 255.0, blue: 98.0 / 255.0)
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(in: proposal.width ?? .infinity, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(in: bounds.width, subviews: subviews)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: result.positions[index].x + bounds.minX,
                                      y: result.positions[index].y + bounds.minY),
                          proposal: .unspecified)
        }
    }

    private func layout(in maxWidth: CGFloat, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }

        let totalHeight = y + lineHeight
        return (CGSize(width: maxWidth, height: totalHeight), positions)
    }
}

private struct ContentErrorView: View {
    let message: String
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .frame(maxHeight: .infinity)
    }
}
