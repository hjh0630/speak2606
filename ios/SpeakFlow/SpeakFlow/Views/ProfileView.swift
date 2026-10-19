import SwiftUI
import UIKit
import AVFoundation
import SpeakFlowKit

/// 我的：本地资料（名字/头像）+ Token 累计 + 历史记录
struct ProfileView: View {
    @StateObject private var profile = UserProfileStore.shared
    @StateObject private var bgm = BackgroundMusicService.shared

    @State private var sessions: [PracticeSession] = []
    @State private var isLoading: Bool = true
    @State private var loadFailed: Bool = false
    @State private var isEditingName: Bool = false
    @State private var editedName: String = ""
    @State private var voices: [TTSVoice] = []
    @State private var showVoicePicker: Bool = false
    @State private var voiceLoadFailed: Bool = false

    /// 与后端 sessions.user_token 对齐
    private var userToken: String {
        UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
    }

    /// 当前选中音色的显示名
    private var selectedVoiceName: String {
        guard let voiceId = profile.voiceId,
              let voice = voices.first(where: { $0.id == voiceId }) else {
            return voices.isEmpty ? "后端默认" : "后端默认"
        }
        return voice.name
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    profileCard
                    tokenCard
                    voiceCard
                    musicCard
                    historySection
                }
                .padding()
            }
            .navigationTitle("我的")
        }
        .task {
            await loadVoices()
            await load()
        }
    }

    // MARK: - 资料卡

    private var profileCard: some View {
        VStack(spacing: 16) {
            appIconAvatar

            if isEditingName {
                HStack(spacing: 12) {
                    TextField("输入名字", text: $editedName)
                        .textFieldStyle(.roundedBorder)
                        .multilineTextAlignment(.center)
                    Button("保存") {
                        profile.setUserName(editedName)
                        isEditingName = false
                    }
                    .buttonStyle(.borderedProminent)
                }
            } else {
                HStack(spacing: 8) {
                    Text(profile.userName)
                        .font(.title2.bold())
                    Button { editedName = profile.userName; isEditingName = true } label: {
                        Image(systemName: "pencil")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Text("点击名字可编辑")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    /// 使用 App 图标作为头像
    private var appIconAvatar: some View {
        Group {
            if let uiImage = appIconUIImage() {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 100, height: 100)
                    .clipShape(Circle())
            } else {
                Text(profile.avatarEmoji)
                    .font(.system(size: 72))
                    .frame(width: 100, height: 100)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(Circle())
            }
        }
    }

    private func appIconUIImage() -> UIImage? {
        guard let icons = Bundle.main.infoDictionary?["CFBundleIcons"] as? [String: Any],
              let primary = icons["CFBundlePrimaryIcon"] as? [String: Any],
              let files = primary["CFBundleIconFiles"] as? [String],
              let name = files.first else { return nil }
        return UIImage(named: name)
    }

    // MARK: - Token 累计

    private var tokenCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Token 使用累计", systemImage: "bolt.fill")
                    .font(.headline)
                Spacer()
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("\(profile.tokenUsage)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                Text("tokens")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text("每完成一轮口语练习自动累加")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - 音色选择

    private var voiceCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("AI 音色", systemImage: "speaker.wave.2.fill")
                    .font(.headline)
                Spacer()
            }

            Button {
                showVoicePicker = true
            } label: {
                HStack {
                    Text(selectedVoiceName)
                        .foregroundStyle(.primary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .sheet(isPresented: $showVoicePicker) {
            VoicePickerSheet(voices: voices)
        }
    }

    // MARK: - 背景音乐开关

    private var musicCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("舒缓配乐", systemImage: "music.note")
                    .font(.headline)
                Spacer()
            }

            Toggle("AI 朗读时播放舒缓伴音", isOn: $bgm.isEnabled)
                .font(.body)

            Text("只在 AI 说话期间轻音播放，说完即淡出停止")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - 历史记录

    private var historySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("练习历史").font(.headline)

            if isLoading {
                ProgressView("加载历史…")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            } else if loadFailed {
                emptyState(
                    icon: "wifi.slash",
                    title: "历史需要联网",
                    subtitle: "本地练习不受影响，联网后再来看看"
                )
            } else if sessions.isEmpty {
                emptyState(
                    icon: "clock",
                    title: "还没有练习记录",
                    subtitle: "去首页选一个场景开始第一次练习吧"
                )
            } else {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(sessions) { s in
                        sessionRow(s)
                    }
                }
            }
        }
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(title).font(.headline)
            Text(subtitle).font(.callout).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
    }

    private func sessionRow(_ s: PracticeSession) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(s.scenarioId).font(.headline)
                Spacer()
                Text(difficultyLabel(s.difficulty))
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(.tertiarySystemBackground))
                    .clipShape(Capsule())
            }
            HStack {
                Text(s.startedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(s.totalRounds) 轮")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let avg = s.avgScore {
                    Text("平均 \(Int(avg)) 分")
                        .font(.caption)
                        .foregroundStyle(avg >= 60 ? Color.green : Color.orange)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - 动作

    private func pickRandomAvatar() {
        let candidates = ["👤", "😀", "🧑‍💼", "👩‍💼", "🦸", "🦹", "🧑‍🎓", "👨‍🏫", "🤖", "🐱", "🐶", "🦊"]
        profile.setAvatarEmoji(candidates.randomElement() ?? "👤")
    }

    private func load() async {
        isLoading = true
        do {
            sessions = try await APIClient.shared.fetchHistory(userToken: userToken)
            loadFailed = false
        } catch {
            sessions = []
            loadFailed = true
        }
        isLoading = false
    }

    private func loadVoices() async {
        do {
            let remote = try await APIClient.shared.fetchVoices()
            voices = remote.isEmpty ? TTSVoice.fallbackVoices : remote
            voiceLoadFailed = false
        } catch {
            voices = TTSVoice.fallbackVoices
            voiceLoadFailed = false
        }
    }
}

// MARK: - 音色选择 Sheet

private struct VoicePickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var profile = UserProfileStore.shared
    let voices: [TTSVoice]

    /// 当前正在试听的音色 ID
    @State private var playingVoiceId: String? = nil
    @State private var player: AVAudioPlayer? = nil

    private var maleVoices: [TTSVoice] { voices.filter { $0.gender == "male" } }
    private var femaleVoices: [TTSVoice] { voices.filter { $0.gender == "female" } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        profile.setVoiceId(nil)
                        dismiss()
                    } label: {
                        HStack {
                            Text("后端默认")
                            Spacer()
                            if profile.voiceId == nil {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(Color.accentColor)
                            }
                        }
                    }
                }

                if !maleVoices.isEmpty {
                    Section("男生") {
                        ForEach(maleVoices) { voice in
                            voiceRow(voice)
                        }
                    }
                }

                if !femaleVoices.isEmpty {
                    Section("女生") {
                        ForEach(femaleVoices) { voice in
                            voiceRow(voice)
                        }
                    }
                }

                if voices.isEmpty {
                    Section {
                        HStack {
                            Spacer()
                            Text("音色列表加载失败，请检查网络")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("选择音色")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .onDisappear {
                player?.stop()
                player = nil
            }
        }
    }

    private func voiceRow(_ voice: TTSVoice) -> some View {
        HStack {
            Button {
                profile.setVoiceId(voice.id)
                dismiss()
            } label: {
                HStack {
                    Text(voice.name).font(.body)
                    Spacer()
                    if profile.voiceId == voice.id {
                        Image(systemName: "checkmark")
                            .foregroundStyle(Color.accentColor)
                    }
                }
            }
            .buttonStyle(.plain)

            Button {
                preview(voice)
            } label: {
                Image(systemName: playingVoiceId == voice.id ? "stop.circle.fill" : "play.circle")
                    .font(.title3)
                    .foregroundStyle(Color.accentColor)
            }
            .buttonStyle(.plain)
        }
    }

    private func preview(_ voice: TTSVoice) {
        if playingVoiceId == voice.id {
            player?.stop()
            player = nil
            playingVoiceId = nil
            return
        }

        playingVoiceId = voice.id
        player?.stop()

        Task {
            do {
                let result = try await APIClient.shared.synthesize(
                    text: "Hello, this is a sample of my voice.",
                    voiceId: voice.id,
                    speed: 0.9
                )
                await MainActor.run {
                    do {
                        let p = try AVAudioPlayer(data: result.audio)
                        p.delegate = PreviewDelegate.shared
                        p.prepareToPlay()
                        self.player = p
                        PreviewDelegate.shared.onFinish = {
                            self.playingVoiceId = nil
                        }
                        p.play()
                    } catch {
                        self.playingVoiceId = nil
                    }
                }
            } catch {
                await MainActor.run {
                    self.playingVoiceId = nil
                }
            }
        }
    }
}

private final class PreviewDelegate: NSObject, AVAudioPlayerDelegate {
    static let shared = PreviewDelegate()
    var onFinish: (() -> Void)?

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish?()
    }
}

#Preview {
    ProfileView()
}
