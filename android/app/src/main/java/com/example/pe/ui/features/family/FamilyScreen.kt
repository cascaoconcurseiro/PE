package com.example.pe.ui.features.family

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.data.PersonWithBalance
import com.example.pe.ui.Routes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilyScreen(
    navController: NavController,
    viewModel: FamilyViewModel = hiltViewModel()
) {
    val balances by viewModel.balances.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Saldos da Família") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { navController.navigate(Routes.ADD_PERSON) }) {
                Icon(Icons.Filled.Add, contentDescription = "Adicionar Pessoa")
            }
        }
    ) { innerPadding ->
        LazyColumn(modifier = Modifier.padding(innerPadding)) {
            items(balances) { personWithBalance ->
                PersonBalanceItem(personWithBalance = personWithBalance)
            }
        }
    }
}

@Composable
fun PersonBalanceItem(personWithBalance: PersonWithBalance) {
    Row(modifier = Modifier.padding(16.dp)) {
        Text(text = personWithBalance.person.name, modifier = Modifier.weight(1f))
        val balance = personWithBalance.balance
        Text(
            text = if (balance > 0) "Te deve R$%.2f".format(balance) else "Você deve R$%.2f".format(Math.abs(balance)),
            color = if (balance > 0) Color.Green else Color.Red
        )
    }
}
