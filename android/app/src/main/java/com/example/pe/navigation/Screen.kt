package com.example.pe.navigation

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object Transactions : Screen("transactions")
    object AddTransaction : Screen("add_transaction")
    object Accounts : Screen("accounts")
    object Categories : Screen("categories")
    object Trips : Screen("trips")
    object CreateEditTrip : Screen("create_edit_trip?tripId={tripId}") {
        fun createRoute(tripId: Int? = null): String {
            return if (tripId != null) "create_edit_trip?tripId=$tripId" else "create_edit_trip"
        }
    }
}