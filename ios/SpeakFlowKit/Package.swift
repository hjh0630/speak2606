// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SpeakFlowKit",
    platforms: [
        .iOS(.v17)  // iPhone 15 Pro 满血 deployment target
    ],
    products: [
        .library(
            name: "SpeakFlowKit",
            targets: ["SpeakFlowKit"]
        ),
    ],
    targets: [
        .target(
            name: "SpeakFlowKit",
            resources: [
                // .copy 保留目录结构:Bundle 根下得到 Scenarios/*.json,
                // ScenarioLoader.allScenarioFiles() 依赖这个子目录;若用 .process 会被拍平
                .copy("Resources/Scenarios"),
                .process("Resources/Dictionary.json"),
                .process("Resources/scenarios.json")
            ]
        ),
        .testTarget(
            name: "SpeakFlowKitTests",
            dependencies: ["SpeakFlowKit"]
            // 不声明 resources：测试直接通过 SpeakFlowKit 的 Bundle.module 访问场景/词典，
            // 空 resources 目录会让 SPM 报 "Invalid Resource" 错误
        ),
    ]
)