package com.speakflow.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.speakflow.app.ui.HistoryScreen
import com.speakflow.app.ui.PracticeScreen
import com.speakflow.app.ui.ScenarioPreviewScreen
import com.speakflow.app.ui.ScenariosScreen
import com.speakflow.app.ui.SettingsScreen

object Routes {
    const val SCENARIOS = "scenarios"
    const val HISTORY = "history"
    const val SETTINGS = "settings"
    const val PREVIEW = "preview/{scenarioId}"
    const val PRACTICE = "practice/{scenarioId}/{difficulty}/{mode}/{title}"

    fun preview(scenarioId: String) = "preview/$scenarioId"

    fun practice(scenarioId: String, difficulty: String, mode: String, title: String): String {
        return "practice/$scenarioId/$difficulty/$mode/${java.net.URLEncoder.encode(title, "UTF-8")}"
    }
}

@Composable
fun SpeakFlowNavGraph(navController: NavHostController = rememberNavController()) {
    NavHost(navController = navController, startDestination = Routes.SCENARIOS) {
        composable(Routes.SCENARIOS) {
            ScenariosScreen(
                onScenarioClick = { scenarioId -> navController.navigate(Routes.preview(scenarioId)) },
                onHistoryClick = { navController.navigate(Routes.HISTORY) },
                onSettingsClick = { navController.navigate(Routes.SETTINGS) },
            )
        }

        composable(
            route = Routes.PREVIEW,
            arguments = listOf(navArgument("scenarioId") { type = NavType.StringType }),
        ) { entry ->
            ScenarioPreviewScreen(
                scenarioId = entry.arguments?.getString("scenarioId").orEmpty(),
                onBack = { navController.popBackStack() },
                onStart = { scenarioId, difficulty, mode, title ->
                    navController.navigate(Routes.practice(scenarioId, difficulty, mode, title))
                },
            )
        }

        composable(
            route = Routes.PRACTICE,
            arguments = listOf(
                navArgument("scenarioId") { type = NavType.StringType },
                navArgument("difficulty") { type = NavType.StringType },
                navArgument("mode") { type = NavType.StringType },
                navArgument("title") { type = NavType.StringType },
            ),
        ) { entry ->
            val args = entry.arguments
            PracticeScreen(
                scenarioId = args?.getString("scenarioId").orEmpty(),
                difficulty = args?.getString("difficulty") ?: "beginner",
                mode = args?.getString("mode") ?: "free",
                scenarioTitle = java.net.URLDecoder.decode(args?.getString("title") ?: "", "UTF-8"),
                onBack = { navController.popBackStack() },
                onFinish = {
                    // 完成后回到场景列表
                    navController.popBackStack(Routes.SCENARIOS, inclusive = false)
                },
            )
        }

        composable(Routes.HISTORY) {
            HistoryScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
    }
}
