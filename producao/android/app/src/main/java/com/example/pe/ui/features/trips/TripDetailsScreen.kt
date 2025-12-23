package com.example.pe.ui.features.trips

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.data.local.model.TripExpense
import com.example.pe.navigation.Screen
import java.text.NumberFormat
import java.util.Locale

fun Double.toCurrency(): String {
    return NumberFormat.getCurrencyInstance(Locale("pt", "BR")).format(this)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripDetailsScreen(navController: NavController, viewModel: TripDetailsViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val trip = uiState.trip

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(trip?.name ?: "Detalhes da Viagem") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.CreateEditTrip.createRoute(trip?.id)) }) {
                        Icon(Icons.Filled.Edit, contentDescription = "Editar Viagem")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { 
                trip?.id?.let { 
                    navController.navigate(Screen.AddEditExpense.createRoute(it))
                }
            }) {
                Icon(Icons.Filled.Add, contentDescription = "Adicionar Despesa")
            }
        }
    ) { innerPadding ->
        LazyColumn(modifier = Modifier.padding(innerPadding).padding(16.dp)) {
            item {
                trip?.let { 
                    Text("Destino: ${it.destination}", style = MaterialTheme.typography.bodyLarge)
                    Text("De: ${it.startDate.toFormattedDate()} a ${it.endDate.toFormattedDate()}", style = MaterialTheme.typography.bodyLarge)
                    
                    Spacer(modifier = Modifier.height(16.dp))

                    Text("Orçamento: ${it.budget.toCurrency()}", style = MaterialTheme.typography.bodyLarge)
                    Text("Total Gasto: ${uiState.totalExpenses.toCurrency()}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold)
                    
                    val progress = if (it.budget > 0) (uiState.totalExpenses / it.budget).toFloat() else 0f
                    LinearProgressIndicator(
                        progress = { progress },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                    )
                }
            }

            item {
                Text(
                    text = "Despesas",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(top = 24.dp, bottom = 8.dp)
                )
            }

            if (uiState.expenses.isEmpty()) {
                item { Text("Nenhuma despesa cadastrada.") }
            } else {
                items(uiState.expenses) { expense ->
                    ExpenseItem(expense) {
                        trip?.id?.let {
                            navController.navigate(Screen.ExpenseDetails.createRoute(it, expense.id))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ExpenseItem(expense: TripExpense, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Text(expense.name, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text(expense.amount.toCurrency(), fontWeight = FontWeight.Bold)
            }
            Text("Categoria: ${expense.category}")
            Text(expense.date.toFormattedDate())
        }
    }
}
