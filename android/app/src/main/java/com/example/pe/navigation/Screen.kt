package com.example.pe.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Transactions : Screen("transactions")
    object AddTransaction : Screen("add_transaction")
    object Accounts : Screen("accounts")
    object Categories : Screen("categories")
}