package com.example.pe.ui.features.cards

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import com.example.pe.data.local.Account

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditCardScreen(
    navController: NavController,
    viewModel: EditCardViewModel = hiltViewModel()
) {
    val card by viewModel.card.collectAsState()
    val accounts by viewModel.accounts.collectAsState()

    var name by remember { mutableStateOf("") }
    var limit by remember { mutableStateOf("") }
    var closingDay by remember { mutableStateOf("") }
    var paymentDay by remember { mutableStateOf("") }
    var selectedAccount by remember { mutableStateOf<Account?>(null) }
    var isAccountMenuExpanded by remember { mutableStateOf(false) }

    LaunchedEffect(card, accounts) {
        card?.let {
            name = it.name
            limit = it.limit.toString()
            closingDay = it.closingDay.toString()
            paymentDay = it.paymentDay.toString()
            selectedAccount = accounts.find { acc -> acc.id == it.accountId }
        }
    }

    Column(modifier = Modifier.padding(16.dp)) {
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome do Cartão") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = limit, onValueChange = { limit = it }, label = { Text("Limite") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = closingDay, onValueChange = { closingDay = it }, label = { Text("Dia do Fechamento") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedTextField(value = paymentDay, onValueChange = { paymentDay = it }, label = { Text("Dia do Pagamento") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = isAccountMenuExpanded,
            onExpandedChange = { isAccountMenuExpanded = !isAccountMenuExpanded },
        ) {
            OutlinedTextField(
                value = selectedAccount?.name ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("Conta para Débito da Fatura") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isAccountMenuExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            ExposedDropdownMenu(
                expanded = isAccountMenuExpanded,
                onDismissRequest = { isAccountMenuExpanded = false }
            ) {
                accounts.forEach { account ->
                    DropdownMenuItem(
                        text = { Text(account.name) },
                        onClick = {
                            selectedAccount = account
                            isAccountMenuExpanded = false
                        }
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Row {
             Button(
                onClick = {
                    viewModel.deleteCard()
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
                    selectedAccount?.let {
                        viewModel.updateCard(name, limit, closingDay, paymentDay, it.id)
                        navController.popBackStack()
                    }
                },
                modifier = Modifier.weight(1f)
            ) {
                Text("Salvar")
            }
        }
    }
}
