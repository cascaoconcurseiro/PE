package com.example.pe.ui.features.accounts

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
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.ui.Routes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen(
    navController: NavController,
    viewModel: AccountsViewModel = hiltViewModel()
) {
    val accounts by viewModel.accounts.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Contas") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { navController.navigate(Routes.ADD_ACCOUNT) }) {
                Icon(Icons.Filled.Add, contentDescription = "Adicionar Conta")
            }
        }
    ) { innerPadding ->
        LazyColumn(modifier = Modifier.padding(innerPadding)) {
            items(accounts) { account ->
                // TODO: Create a nice AccountItem composable
                Text(text = "${account.name} - R$%.2f".format(account.initialBalance), modifier = Modifier.padding(16.dp))
            }
        }
    }
}
