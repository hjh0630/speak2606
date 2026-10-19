import SwiftUI
import SpeakFlowKit

@main
struct SpeakFlowApp: App {
    init() {
        // 预初始化伴音服务（不播放，等 AI 朗读时再起）
        _ = BackgroundMusicService.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

/// 3 Tab 根视图：首页（含场景）、生词本、我的
struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(selectedTab: $selectedTab)
                .tabItem { Label("首页", systemImage: "house.fill") }
                .tag(0)
            WordbookView()
                .tabItem { Label("生词本", systemImage: "book.fill") }
                .tag(1)
            ProfileView()
                .tabItem { Label("我的", systemImage: "person.fill") }
                .tag(2)
        }
    }
}
