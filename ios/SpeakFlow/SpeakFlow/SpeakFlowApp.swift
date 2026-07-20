import SwiftUI
import SpeakFlowKit

@main
struct SpeakFlowApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// 5 Tab 根视图（占位，Mac 上 Xcode 替换为完整实现）
struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem { Label("首页", systemImage: "house.fill") }
                .tag(0)
            ScenariosView()
                .tabItem { Label("场景", systemImage: "list.bullet.rectangle") }
                .tag(1)
            PracticeLauncherView()
                .tabItem { Label("练习", systemImage: "mic.fill") }
                .tag(2)
            WordbookView()
                .tabItem { Label("生词本", systemImage: "book.fill") }
                .tag(3)
            HistoryView()
                .tabItem { Label("历史", systemImage: "clock.fill") }
                .tag(4)
        }
    }
}

// MARK: - 占位视图（Mac 上 Xcode 实现完整版）

struct HomeView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("SpeakFlow").font(.largeTitle).bold()
                Text("服装纺织英语口语练习").foregroundStyle(.secondary)
                Spacer()
            }
            .padding()
            .navigationTitle("首页")
        }
    }
}

struct ScenariosView: View {
    var body: some View {
        NavigationStack {
            Text("26 场景列表 - 待实现").foregroundStyle(.secondary)
                .navigationTitle("场景")
        }
    }
}

struct PracticeLauncherView: View {
    var body: some View {
        NavigationStack {
            Text("选择场景开始练习 - 待实现").foregroundStyle(.secondary)
                .navigationTitle("练习")
        }
    }
}

struct WordbookView: View {
    var body: some View {
        NavigationStack {
            Text("生词本 CRUD - 待实现").foregroundStyle(.secondary)
                .navigationTitle("生词本")
        }
    }
}

struct HistoryView: View {
    var body: some View {
        NavigationStack {
            Text("历史会话 - 待实现").foregroundStyle(.secondary)
                .navigationTitle("历史")
        }
    }
}