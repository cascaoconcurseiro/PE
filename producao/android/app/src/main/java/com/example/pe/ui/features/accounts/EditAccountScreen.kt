package com.example.pe.ui.features.accounts

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController

@Composable
fun EditAccountScreen(
    navController: NavController,
    viewModel: EditAccountViewModel = hiltViewModel()
) {
    val account by viewModel.account.collectAsState()

    var name by remember { mutableStateOf("") }
    var initialBalance by remember { mutableStateOf("") }

    LaunchedEffect(account) {
        account?.let {
            name = it.name
            initialBalance = it.initialBalance.toString()
        }
    }

    Column(modifier = Modifier.padding(16.dp)) {
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Nome da Conta") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = initialBalance,
            onValueChange = { initialBalance = it },
            label = { Text("Saldo Inicial") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.padding(16.dp))

        Row {
            Button(
                onClick = {
                    viewModel.deleteAccount()
                    navController.popBackStack()
                },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                modifier = Modifier.weight(1f)
            ) {
                Text("Excluir")
            }
            Spacer(modifier = Modifier.padding(8.dp))
            Button(
                onClick = {
                    viewModel.updateAccount(name, initialBalance)
                    navController.popBackStack()
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Salvar")
            }
        }
    }
}
