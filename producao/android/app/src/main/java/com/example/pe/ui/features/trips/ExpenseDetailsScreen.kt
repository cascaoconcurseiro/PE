package com.example.pe.ui.features.trips

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.data.local.Person
import com.example.pe.data.local.model.DebtParticipant
import com.example.pe.data.local.model.SplitType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseDetailsScreen(
    navController: NavController,
    viewModel: ExpenseDetailsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showAddParticipantDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.expense?.name ?: "Detalhes da Despesa") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(modifier = Modifier.padding(innerPadding).padding(16.dp)) {
            item {
                // Paid By Dropdown
                var paidByExpanded by remember { mutableStateOf(false) }
                Text("Pago por:", style = MaterialTheme.typography.titleMedium)
                ExposedDropdownMenuBox(expanded = paidByExpanded, onExpandedChange = { paidByExpanded = !paidByExpanded }) {
                    OutlinedTextField(
                        value = uiState.paidBy?.name ?: "Selecione...",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = paidByExpanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(expanded = paidByExpanded, onDismissRequest = { paidByExpanded = false }) {
                        uiState.allParticipants.forEach { person ->
                            DropdownMenuItem(
                                text = { Text(person.name) },
                                onClick = {
                                    viewModel.setPaidBy(person.id)
                                    paidByExpanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Split Type Buttons
                Text("Tipo de Divisão:", style = MaterialTheme.typography.titleMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SplitType.values().forEach { splitType ->
                        OutlinedButton(onClick = { /* viewModel.calculateSplit(splitType) */ }) {
                            Text(splitType.name)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Participants in Split
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Dividido Com:", style = MaterialTheme.typography.titleMedium)
                    Button(onClick = { showAddParticipantDialog = true }) {
                        Text("Adicionar")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            items(uiState.debtParticipants) { debtParticipant ->
                val person = uiState.allParticipants.find { it.id == debtParticipant.personId }
                if (person != null) {
                    DebtParticipantItem(person = person, debt = debtParticipant) {
                        viewModel.removeParticipantFromSplit(person.id)
                    }
                }
            }
        }
    }

    if (showAddParticipantDialog) {
        AddDebtParticipantDialog(
            people = uiState.allParticipants.filter { person -> uiState.debtParticipants.none { it.personId == person.id } },
            onDismiss = { showAddParticipantDialog = false },
            onConfirm = { personId ->
                viewModel.addParticipantToSplit(personId)
                showAddParticipantDialog = false
            }
        )
    }
}

@Composable
fun DebtParticipantItem(person: Person, debt: DebtParticipant, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(person.name, modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold)
            Text(debt.amountOwed.toCurrency())
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Remover da Divisão")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddDebtParticipantDialog(people: List<Person>, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    var selectedPerson by remember { mutableStateOf<Person?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adicionar à Divisão") },
        text = {
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                OutlinedTextField(
                    value = selectedPerson?.name ?: "Selecione...",
                    onValueChange = {},
                    readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.menuAnchor().fillMaxWidth()
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    people.forEach { person ->
                        DropdownMenuItem(
                            text = { Text(person.name) },
                            onClick = {
                                selectedPerson = person
                                expanded = false
                            }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = { selectedPerson?.id?.let(onConfirm) }, enabled = selectedPerson != null) {
                Text("Adicionar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}

