package com.example.pe.ui.features.accounts

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController

@Composable
fun AddAccountScreen(
    navController: NavController,
    viewModel: AddAccountViewModel = hiltViewModel()
) {
    var name by remember { mutableStateOf("") }
    var initialBalance by remember { mutableStateOf("") }

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

        Button(
            onClick = {
                viewModel.saveAccount(name, initialBalance)
                navController.popBackStack()
            },
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp)
        ) {
            Text("Salvar")
        }
    }
}
