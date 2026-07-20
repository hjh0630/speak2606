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
                .process("Resources")  // Bundle: Scenarios/*.json + Dictionary.json
            ]
        ),
        .testTarget(
            name: "SpeakFlowKitTests",
            dependencies: ["SpeakFlowKit"],
            resources: [
                .process("Resources")  // 测试用同一份资源
            ]
        ),
    ]
)