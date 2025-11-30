package com.example.pe.ui

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.pe.ui.features.add.AddTransactionScreen
import com.example.pe.ui.features.main.MainScreen

object Routes {
    const val MAIN = "main"
    const val ADD_TRANSACTION = "add_transaction"
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.MAIN) {
        composable(Routes.MAIN) {
            MainScreen(navController = navController)
        }
        composable(Routes.ADD_TRANSACTION) {
            AddTransactionScreen(navController = navController)
        }
    }
}
