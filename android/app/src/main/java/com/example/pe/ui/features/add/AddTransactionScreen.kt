package com.example.pe.ui.features.add

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import com.example.pe.data.local.Card
import com.example.pe.data.local.Category

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTransactionScreen(
    navController: NavController,
    viewModel: AddTransactionViewModel = hiltViewModel()
) {
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var currency by remember { mutableStateOf("BRL") } // Default to BRL
    val categories by viewModel.categories.collectAsState()
    val accounts by viewModel.accounts.collectAsState()
    val cards by viewModel.cards.collectAsState()
    
    var paymentType by remember { mutableStateOf(PaymentType.DEBIT) }
    var selectedCategory by remember { mutableStateOf<Category?>(null) }
    var selectedAccount by remember { mutableStateOf<Account?>(null) }
    var selectedCard by remember { mutableStateOf<Card?>(null) }
    var isCategoryMenuExpanded by remember { mutableStateOf(false) }
    var isAccountMenuExpanded by remember { mutableStateOf(false) }
    var isCardMenuExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.padding(16.dp)) {
        OutlinedTextField(value = description, onValueChange = { description = it }, label = { Text("Descrição") }, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(8.dp))
        
        Row(modifier = Modifier.fillMaxWidth()) {
            OutlinedTextField(value = amount, onValueChange = { amount = it }, label = { Text("Valor") }, modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.width(8.dp))
            OutlinedTextField(value = currency, onValueChange = { currency = it }, label = { Text("Moeda") }, modifier = Modifier.width(100.dp))
        }
        
        Spacer(modifier = Modifier.height(8.dp))

        // Payment Type Toggle
        Row {
            OutlinedButton(onClick = { paymentType = PaymentType.DEBIT }, enabled = paymentType != PaymentType.DEBIT) { Text("Débito") }
            Spacer(modifier = Modifier.padding(4.dp))
            OutlinedButton(onClick = { paymentType = PaymentType.CREDIT }, enabled = paymentType != PaymentType.CREDIT) { Text("Crédito") }
        }
        Spacer(modifier = Modifier.height(8.dp))
        
        // Dropdowns
        if (paymentType == PaymentType.DEBIT) {
            // Account Dropdown
             ExposedDropdownMenuBox(expanded = isAccountMenuExpanded, onExpandedChange = { isAccountMenuExpanded = !isAccountMenuExpanded }) {
                OutlinedTextField(value = selectedAccount?.name ?: "", onValueChange = {}, readOnly = true, label = { Text("Conta") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isAccountMenuExpanded) }, modifier = Modifier.menuAnchor().fillMaxWidth())
                ExposedDropdownMenu(expanded = isAccountMenuExpanded, onDismissRequest = { isAccountMenuExpanded = false }) {
                    accounts.forEach { account -> DropdownMenuItem(text = { Text(account.name) }, onClick = { selectedAccount = account; isAccountMenuExpanded = false }) }
                }
            }
        } else {
             // Card Dropdown
            ExposedDropdownMenuBox(expanded = isCardMenuExpanded, onExpandedChange = { isCardMenuExpanded = !isCardMenuExpanded }) {
                OutlinedTextField(value = selectedCard?.name ?: "", onValueChange = {}, readOnly = true, label = { Text("Cartão") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isCardMenuExpanded) }, modifier = Modifier.menuAnchor().fillMaxWidth())
                ExposedDropdownMenu(expanded = isCardMenuExpanded, onDismissRequest = { isCardMenuExpanded = false }) {
                    cards.forEach { card -> DropdownMenuItem(text = { Text(card.name) }, onClick = { selectedCard = card; isCardMenuExpanded = false }) }
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))

        // Category Dropdown
        ExposedDropdownMenuBox(expanded = isCategoryMenuExpanded, onExpandedChange = { isCategoryMenuExpanded = !isCategoryMenuExpanded }) {
            OutlinedTextField(value = selectedCategory?.name ?: "", onValueChange = {}, readOnly = true, label = { Text("Categoria") }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isCategoryMenuExpanded) }, modifier = Modifier.menuAnchor().fillMaxWidth())
            ExposedDropdownMenu(expanded = isCategoryMenuExpanded, onDismissRequest = { isCategoryMenuExpanded = false }) {
                categories.forEach { category -> DropdownMenuItem(text = { Text(category.name) }, onClick = { selectedCategory = category; isCategoryMenuExpanded = false }) }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = {
                selectedCategory?.let { category ->
                    viewModel.saveTransaction(description, amount, currency, category.id, paymentType, selectedAccount?.id, selectedCard?.id)
                    navController.popBackStack()
                }
            },
            enabled = selectedCategory != null && (selectedAccount != null || selectedCard != null),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Salvar")
        }
    }
}
