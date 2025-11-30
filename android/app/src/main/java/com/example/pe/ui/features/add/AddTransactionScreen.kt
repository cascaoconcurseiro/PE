package com.example.pe.ui.features.add

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import com.example.pe.data.local.Category

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTransactionScreen(
    navController: NavController,
    viewModel: AddTransactionViewModel = hiltViewModel()
) {
    var description by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    val categories by viewModel.categories.collectAsState()
    val accounts by viewModel.accounts.collectAsState()
    var selectedCategory by remember { mutableStateOf<Category?>(null) }
    var selectedAccount by remember { mutableStateOf<Account?>(null) }
    var isCategoryMenuExpanded by remember { mutableStateOf(false) }
    var isAccountMenuExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.padding(16.dp)) {
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("Descrição") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = amount,
            onValueChange = { amount = it },
            label = { Text("Valor") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(8.dp))

        // Category Dropdown
        ExposedDropdownMenuBox(
            expanded = isCategoryMenuExpanded,
            onExpandedChange = { isCategoryMenuExpanded = !isCategoryMenuExpanded },
        ) {
            OutlinedTextField(
                value = selectedCategory?.name ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("Categoria") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isCategoryMenuExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            ExposedDropdownMenu( 
                expanded = isCategoryMenuExpanded, 
                onDismissRequest = { isCategoryMenuExpanded = false } 
            ) {
                categories.forEach { category ->
                    DropdownMenuItem(
                        text = { Text(category.name) },
                        onClick = {
                            selectedCategory = category
                            isCategoryMenuExpanded = false
                        }
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))

        // Account Dropdown
        ExposedDropdownMenuBox(
            expanded = isAccountMenuExpanded,
            onExpandedChange = { isAccountMenuExpanded = !isAccountMenuExpanded },
        ) {
            OutlinedTextField(
                value = selectedAccount?.name ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("Conta") },
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

        Button(
            onClick = {
                selectedCategory?.let { category ->
                    selectedAccount?.let { account ->
                        viewModel.saveTransaction(description, amount, category.id, account.id)
                        navController.popBackStack()
                    }
                }
            },
            enabled = selectedCategory != null && selectedAccount != null,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Salvar")
        }
    }
}
