package com.example.pe.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

@Composable
fun NavGraph() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = Screen.Home.route) {
        composable(Screen.Home.route) { 
            // TODO: Implement Home Screen
        }
        composable(Screen.Transactions.route) {
            // TODO: Implement Transactions Screen
        }
        composable(Screen.AddTransaction.route) {
            // TODO: Implement Add Transaction Screen
        }
        composable(Screen.Accounts.route) {
            // TODO: Implement Accounts Screen
        }
        composable(Screen.Categories.route) {
            // TODO: Implement Categories Screen
        }
    }
}