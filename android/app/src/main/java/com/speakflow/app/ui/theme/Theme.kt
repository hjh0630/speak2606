package com.speakflow.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// 主色与 web 前端 frontend/tailwind.config.js 的 brand/accent/ink 对齐
val Brand500 = Color(0xFF1F8FB3) // brand.500 品牌标志色
val Brand600 = Color(0xFF1A7DA0) // hover
val Brand700 = Color(0xFF14598D) // 深海军
val Brand200 = Color(0xFFABC9D5)
val Brand50 = Color(0xFFD6E1E7)

val Accent500 = Color(0xFFD17F50) // accent.500 CTA 主色
val Accent400 = Color(0xFFF0A878) // 暖桃

val Ink50 = Color(0xFFF6F8FB)
val Ink100 = Color(0xFFECF0F6)
val Ink200 = Color(0xFFD8DEE9)
val Ink400 = Color(0xFF8590A8)
val Ink500 = Color(0xFF586475)
val Ink700 = Color(0xFF2A3142)
val Ink900 = Color(0xFF0E121B)

private val LightColors = lightColorScheme(
    primary = Brand500,
    onPrimary = Color.White,
    primaryContainer = Brand50,
    onPrimaryContainer = Brand700,
    secondary = Accent500,
    onSecondary = Color.White,
    secondaryContainer = Accent400,
    onSecondaryContainer = Ink900,
    background = Ink50,
    onBackground = Ink900,
    surface = Color.White,
    onSurface = Ink900,
    surfaceVariant = Ink100,
    onSurfaceVariant = Ink500,
    outline = Ink200,
    error = Color(0xFFB3261E),
    onError = Color.White,
)

@Composable
fun SpeakFlowTheme(content: @Composable () -> Unit) {
    // 与 iOS/Web 一致,固定浅色主题
    MaterialTheme(
        colorScheme = LightColors,
        content = content,
    )
}
