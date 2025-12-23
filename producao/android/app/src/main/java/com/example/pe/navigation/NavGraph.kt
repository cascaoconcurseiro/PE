package com.example.pe.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.CardTravel
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.pe.ui.features.accounts.AccountsScreen
import com.example.pe.ui.features.add_transaction.AddTransactionScreen
import com.example.pe.ui.features.home.HomeScreen
import com.example.pe.ui.features.transactions.TransactionsScreen
import com.example.pe.ui.features.trips.AddEditExpenseScreen
import com.example.pe.ui.features.trips.CreateEditTripScreen
import com.example.pe.ui.features.trips.ExpenseDetailsScreen
import com.example.pe.ui.features.trips.TripDetailsScreen
import com.example.pe.ui.features.trips.TripsScreen

sealed class BottomNavItem(val screen: Screen, val icon: ImageVector, val label: String) {
    object Home : BottomNavItem(Screen.Home, Icons.Default.Home, "Início")
    object Transactions : BottomNavItem(Screen.Transactions, Icons.Default.SwapHoriz, "Transações")
    object Accounts : BottomNavItem(Screen.Accounts, Icons.Default.AccountBalance, "Contas")
    object Trips : BottomNavItem(Screen.Trips, Icons.Default.CardTravel, "Viagens")
}

@Composable
fun NavGraph() {
    val navController = rememberNavController()

    val bottomNavItems = listOf(
        BottomNavItem.Home,
        BottomNavItem.Transactions,
        BottomNavItem.Accounts,
        BottomNavItem.Trips
    )

    Scaffold(
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination

                bottomNavItems.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                        selected = currentDestination?.hierarchy?.any { it.route == item.screen.route } == true,
                        onClick = {
                            navController.navigate(item.screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) { HomeScreen(navController) }
            composable(Screen.Transactions.route) { TransactionsScreen() }
            composable(Screen.Accounts.route) { AccountsScreen() }
            composable(Screen.AddTransaction.route) { AddTransactionScreen() }
            composable(Screen.Trips.route) { TripsScreen(navController) }
            composable(
                route = Screen.CreateEditTrip.route,
                arguments = listOf(navArgument("tripId") { 
                    type = NavType.StringType
                    nullable = true
                })
            ) { 
                CreateEditTripScreen(navController)
            }
            composable(
                route = Screen.TripDetails.route,
                arguments = listOf(navArgument("tripId") { type = NavType.IntType })
            ) {
                TripDetailsScreen(navController)
            }
            composable(
                route = Screen.AddEditExpense.route,
                arguments = listOf(
                    navArgument("tripId") { type = NavType.IntType },
                    navArgument("expenseId") { 
                        type = NavType.StringType
                        nullable = true
                    }
                )
            ) {
                AddEditExpenseScreen(navController)
            }
            composable(
                route = Screen.ExpenseDetails.route,
                arguments = listOf(
                    navArgument("tripId") { type = NavType.IntType },
                    navArgument(
                        name = "expenseId",
                        builder = { type = NavType.StringType } // Changed to String to match the ViewModel
                    )
                )
            ) {
                ExpenseDetailsScreen(navController)
            }
        }
    }
}
