package com.example.pe.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.pe.ui.features.add.AddTransactionScreen

object Routes {
    const val HOME = "home"
    const val ADD_TRANSACTION = "add_transaction"
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.HOME) {
        composable(Routes.HOME) {
            AppScaffold() // The main screen with bottom navigation is now the root
        }
        composable(Routes.ADD_TRANSACTION) {
            AddTransactionScreen(navController = navController)
        }
    }
}
