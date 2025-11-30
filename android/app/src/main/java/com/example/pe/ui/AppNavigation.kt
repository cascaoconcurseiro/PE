package com.example.pe.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.pe.ui.features.accounts.AddAccountScreen
import com.example.pe.ui.features.accounts.EditAccountScreen
import com.example.pe.ui.features.add.AddTransactionScreen
import com.example.pe.ui.features.cards.AddCardScreen
import com.example.pe.ui.features.cards.EditCardScreen
import com.example.pe.ui.features.edit.EditTransactionScreen
import com.example.pe.ui.features.family.AddPersonScreen

object Routes {
    const val HOME = "home"
    const val ADD_TRANSACTION = "add_transaction"
    const val ADD_ACCOUNT = "add_account"
    const val ADD_CARD = "add_card"
    const val ADD_PERSON = "add_person"
    const val EDIT_TRANSACTION = "edit_transaction"
    const val EDIT_ACCOUNT = "edit_account"
    const val EDIT_CARD = "edit_card"
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
        composable(Routes.ADD_PERSON) {
            AddPersonScreen(navController = navController)
        }
        composable(
            route = "${Routes.EDIT_TRANSACTION}/{transactionId}",
            arguments = listOf(navArgument("transactionId") { type = NavType.StringType })
        ) {
            EditTransactionScreen(navController = navController)
        }
        composable(
            route = "${Routes.EDIT_ACCOUNT}/{accountId}",
            arguments = listOf(navArgument("accountId") { type = NavType.StringType })
        ) {
            EditAccountScreen(navController = navController)
        }
        composable(
            route = "${Routes.EDIT_CARD}/{cardId}",
            arguments = listOf(navArgument("cardId") { type = NavType.StringType })
        ) {
            EditCardScreen(navController = navController)
        }
    }
}
