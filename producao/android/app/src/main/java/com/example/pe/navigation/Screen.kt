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
    object TripDetails : Screen("trip_details/{tripId}") {
        fun createRoute(tripId: Int): String = "trip_details/$tripId"
    }
    object AddEditExpense : Screen("add_edit_expense/{tripId}?expenseId={expenseId}") {
        fun createRoute(tripId: Int, expenseId: Int? = null): String {
            return if (expenseId != null) {
                "add_edit_expense/$tripId?expenseId=$expenseId"
            } else {
                "add_edit_expense/$tripId"
            }
        }
    }
    object ExpenseDetails : Screen("expense_details/{tripId}/{expenseId}") {
        fun createRoute(tripId: Int, expenseId: Int): String = "expense_details/$tripId/$expenseId"
    }
}