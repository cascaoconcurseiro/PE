package com.example.pe.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.filled.SyncAlt
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.example.pe.ui.features.accounts.AccountsScreen
import com.example.pe.ui.features.cards.CardsScreen
import com.example.pe.ui.features.main.MainScreen
import com.example.pe.ui.features.reports.ReportsScreen

sealed class BottomNavItem(val route: String, val icon: ImageVector, val label: String) {
    object Transactions : BottomNavItem("transactions", Icons.Default.SyncAlt, "Transações")
    object Accounts : BottomNavItem("accounts", Icons.Default.AccountBalance, "Contas")
    object Cards : BottomNavItem("cards", Icons.Default.CreditCard, "Cartões")
    object Reports : BottomNavItem("reports", Icons.Default.PieChart, "Relatórios")
}

@Composable
fun AppScaffold(appViewModel: MainAppViewModel = hiltViewModel()) {
    val navController = rememberNavController()
    val items = listOf(BottomNavItem.Transactions, BottomNavItem.Accounts, BottomNavItem.Cards, BottomNavItem.Reports)
    val snackbarHostState = remember { SnackbarHostState() }
    val snackbarManager = appViewModel.snackbarManager

    val snackbarMessage by snackbarManager.messages.collectAsState()
    LaunchedEffect(snackbarMessage) {
        snackbarMessage?.let {
            snackbarHostState.showSnackbar(it)
            snackbarManager.clearMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            NavigationBar {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                items.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label) },
                        selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                        onClick = {
                            navController.navigate(screen.route) {
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
            startDestination = BottomNavItem.Transactions.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(BottomNavItem.Transactions.route) { MainScreen(navController) }
            composable(BottomNavItem.Accounts.route) { AccountsScreen(navController) }
            composable(BottomNavItem.Cards.route) { CardsScreen(navController) }
            composable(BottomNavItem.Reports.route) { ReportsScreen() }
        }
    }
}
