import SwiftUI
import UIKit
import SpeakFlowKit

/// 生词本：本地 SwiftData 列表 + 在线/离线查词 + 导出 Anki CSV
/// iOS 26 SDK 起 URL 不再自动符合 Identifiable，用包装类型给 .sheet(item:) 用
private struct ExportFile: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

struct WordbookView: View {
    @State private var items: [VocabularyItem] = []
    @State private var loadError: String?

    @State private var query: String = ""
    @State private var searching: Bool = false
    @State private var searchResult: DictionaryEntry?
    @State private var searchError: String?
    @State private var justAdded: Bool = false

    @State private var exportFile: ExportFile?
    @State private var exportError: String?

    var body: some View {
        NavigationStack {
            List {
                // 查词区
                Section("查词") {
                    HStack {
                        TextField("输入英文单词", text: $query)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .onSubmit { search() }
                        if searching {
                            ProgressView()
                        } else {
                            Button("查询") { search() }
                                .disabled(query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                    if let result = searchResult {
                        lookupResultCard(result)
                    } else if let error = searchError {
                        Text(error).font(.caption).foregroundStyle(.red)
                    }
                }

                // 生词列表
                Section("我的生词（\(items.count)）") {
                    if let error = loadError {
                        Text(error).font(.caption).foregroundStyle(.red)
                    } else if items.isEmpty {
                        Text("还没有生词，查词后加入吧").foregroundStyle(.secondary)
                    } else {
                        ForEach(items) { item in
                            vocabRow(item)
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        delete(item)
                                    } label: {
                                        Label("删除", systemImage: "trash")
                                    }
                                }
                        }
                    }
                }
            }
            .navigationTitle("生词本")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        exportCSV()
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .disabled(items.isEmpty)
                }
            }
            .sheet(item: $exportFile) { file in
                ActivityView(activityItems: [file.url])
            }
            .alert("导出失败", isPresented: Binding(
                get: { exportError != nil },
                set: { if !$0 { exportError = nil } }
            )) {
                Button("好", role: .cancel) { exportError = nil }
            } message: {
                Text(exportError ?? "")
            }
        }
        .task { reload() }
    }

    // MARK: - 子视图

    private func vocabRow(_ item: VocabularyItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text(item.word).font(.headline)
                if let phonetic = item.phonetic, !phonetic.isEmpty {
                    Text(phonetic).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text(stars(item.difficulty))
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
            if let zh = item.definitionZh ?? item.definitionEn {
                Text(zh).font(.callout).foregroundStyle(.secondary).lineLimit(2)
            }
            Text("复习 \(item.reviewCount) 次")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }

    /// 查词结果卡片
    private func lookupResultCard(_ entry: DictionaryEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(entry.word).font(.headline)
                if let phonetic = entry.phonetic {
                    Text(phonetic).font(.caption).foregroundStyle(.secondary)
                }
                if let pos = entry.partOfSpeech {
                    Text(pos).font(.caption).foregroundStyle(.secondary)
                }
            }
            if let zh = entry.definitionZh {
                Text(zh).font(.callout)
            } else if let en = entry.definitionEn {
                Text(en).font(.callout)
            }
            if let example = entry.example {
                Text(example).font(.caption).foregroundStyle(.secondary).italic()
            }
            if justAdded {
                Label("已加入生词本", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            } else {
                Button("加入生词本") { add(entry) }
                    .buttonStyle(.borderedProminent)
                    .font(.callout)
            }
        }
        .padding(.vertical, 4)
    }

    private func stars(_ difficulty: Int) -> String {
        let d = min(5, max(0, difficulty))
        return String(repeating: "★", count: d) + String(repeating: "☆", count: 5 - d)
    }

    // MARK: - 数据操作

    private func reload() {
        do {
            items = try VocabularyStore.shared.all()
            loadError = nil
        } catch {
            loadError = "生词本读取失败：\(error.localizedDescription)"
        }
    }

    private func delete(_ item: VocabularyItem) {
        do {
            try VocabularyStore.shared.delete(word: item.word)
            reload()
        } catch {
            loadError = "删除失败：\(error.localizedDescription)"
        }
    }

    /// 查词：在线走 API，失败回退本地词典
    private func search() {
        let w = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !w.isEmpty else { return }
        searching = true
        searchError = nil
        searchResult = nil
        justAdded = false
        Task {
            do {
                searchResult = try await APIClient.shared.lookupWord(w)
            } catch {
                // 离线 fallback：本地词典精确/前缀匹配
                let local = (try? ScenarioLoader.loadDictionary())?.first {
                    $0.word.lowercased() == w.lowercased()
                } ?? (try? ScenarioLoader.loadDictionary())?.first {
                    $0.word.lowercased().hasPrefix(w.lowercased())
                }
                if let local {
                    searchResult = local
                } else {
                    searchError = "未找到「\(w)」（后端不可用，本地词典无此词）"
                }
            }
            searching = false
        }
    }

    private func add(_ entry: DictionaryEntry) {
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
            justAdded = true
            reload()
        } catch {
            searchError = "加入失败：\(error.localizedDescription)"
        }
    }

    /// 导出 Anki CSV 到临时文件后系统分享
    private func exportCSV() {
        do {
            let csv = try VocabularyStore.shared.exportAnkiCSV()
            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("speakflow_wordbook.csv")
            try csv.write(to: url, atomically: true, encoding: .utf8)
            exportFile = ExportFile(url: url)
        } catch {
            exportError = error.localizedDescription
        }
    }
}

/// 系统分享面板（UIActivityViewController 的 SwiftUI 包装）
struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    WordbookView()
}
