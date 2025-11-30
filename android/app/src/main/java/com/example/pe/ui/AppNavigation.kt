package com.example.pe.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.pe.ui.features.accounts.AddAccountScreen
import com.example.pe.ui.features.add.AddTransactionScreen
import com.example.pe.ui.features.cards.AddCardScreen
import com.example.pe.ui.features.edit.EditTransactionScreen

object Routes {
    const val HOME = "home"
    const val ADD_TRANSACTION = "add_transaction"
    const val ADD_ACCOUNT = "add_account"
    const val ADD_CARD = "add_card"
    const val EDIT_TRANSACTION = "edit_transaction"
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
        composable(Routes.ADD_ACCOUNT) {
            AddAccountScreen(navController = navController)
        }
        composable(Routes.ADD_CARD) {
            AddCardScreen(navController = navController)
        }
        composable(
            route = "${Routes.EDIT_TRANSACTION}/{transactionId}",
            arguments = listOf(navArgument("transactionId") { type = NavType.StringType })
        ) {
            EditTransactionScreen(navController = navController)
        }
    }
}
