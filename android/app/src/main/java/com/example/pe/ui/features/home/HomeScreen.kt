package com.example.pe.ui.features.home

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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

// TODO: Move to its own file
data class Transaction(val id: Int, val description: String, val amount: Double)

// TODO: Move to its own file
@Composable
fun TransactionItem(transaction: Transaction) {
    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = transaction.description)
            Text(text = "R$ ${transaction.amount}")
        }
    }
}

// TODO: Move to its own file
class HomeViewModel : ViewModel() {
    private val _transactions = MutableStateFlow(listOf(
        Transaction(1, "Salário", 5000.0),
        Transaction(2, "Aluguel", -1500.0),
        Transaction(3, "Supermercado", -450.0),
    ))
    val transactions: StateFlow<List<Transaction>> = _transactions
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: HomeViewModel = viewModel()) {
    val transactions by viewModel.transactions.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Pé de Meia") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { /* TODO: Navigate to add transaction screen */ }) {
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
                    Text(text = "R$ 3.050,00") // Placeholder
                }
            }

            // Recent Transactions
            Text(
                text = "Transações Recentes",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Transactions List
            LazyColumn {
                items(transactions) { transaction ->
                    TransactionItem(transaction = transaction)
                }
            }
        }
    }
}
