package com.example.pe.ui.features.main

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.ui.Routes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    navController: NavController,
    viewModel: MainViewModel = hiltViewModel()
) {
    val transactions by viewModel.transactions.collectAsState(initial = emptyList())
    val totalBalance by viewModel.totalBalance.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Minhas Finanças") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { navController.navigate(Routes.ADD_TRANSACTION) }) {
                Icon(Icons.Filled.Add, contentDescription = "Adicionar Transação")
            }
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding)) {
            // Summary Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(text = "Saldo Total")
                    Text(text = "R$ %.2f".format(totalBalance))
                }
            }

            // Recent Transactions
            Text(
                text = "Transações Recentes",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Transactions List
            LazyColumn {
                items(transactions) { transactionWithCategory ->
                    TransactionItem(
                        transactionWithCategory = transactionWithCategory,
                        onClick = {
                            navController.navigate("${Routes.EDIT_TRANSACTION}/${transactionWithCategory.transaction.id}")
                        }
                    )
                }
            }
        }
    }
}
