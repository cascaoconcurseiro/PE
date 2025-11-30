package com.example.pe.ui.features.trips

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Done
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.data.local.Person
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateEditTripScreen(navController: NavController, viewModel: CreateEditTripViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    var showStartDatePicker by remember { mutableStateOf(false) }
    var showEndDatePicker by remember { mutableStateOf(false) }
    var showDeleteConfirmation by remember { mutableStateOf(false) }
    var showAddParticipantDialog by remember { mutableStateOf(false) }

    val topBarTitle = if (uiState.id == null) "Nova Viagem" else "Editar Viagem"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(topBarTitle) },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                actions = {
                    if (uiState.id != null) {
                        IconButton(onClick = { showDeleteConfirmation = true }) {
                            Icon(Icons.Filled.Delete, contentDescription = "Excluir Viagem")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                viewModel.saveTrip()
                navController.popBackStack()
            }) {
                Icon(Icons.Filled.Done, contentDescription = "Salvar Viagem")
            }
        }
    ) { innerPadding ->
        LazyColumn(modifier = Modifier.padding(innerPadding).padding(16.dp)) {
            item {
                OutlinedTextField(
                    value = uiState.name,
                    onValueChange = { viewModel.onNameChange(it) },
                    label = { Text("Nome da Viagem") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = uiState.destination,
                    onValueChange = { viewModel.onDestinationChange(it) },
                    label = { Text("Destino") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = uiState.startDate?.toFormattedDate() ?: "",
                    onValueChange = { },
                    label = { Text("Data de Início") },
                    modifier = Modifier.fillMaxWidth().clickable { showStartDatePicker = true },
                    enabled = false,
                    readOnly = true
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = uiState.endDate?.toFormattedDate() ?: "",
                    onValueChange = { },
                    label = { Text("Data de Fim") },
                    modifier = Modifier.fillMaxWidth().clickable { showEndDatePicker = true },
                    enabled = false,
                    readOnly = true
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = uiState.budget,
                    onValueChange = { viewModel.onBudgetChange(it) },
                    label = { Text("Orçamento") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }

            if (uiState.id != null) {
                item {
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Participantes", style = MaterialTheme.typography.titleLarge)
                        IconButton(onClick = { showAddParticipantDialog = true }) {
                            Icon(Icons.Default.Add, contentDescription = "Adicionar Participante")
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                items(uiState.participants) { person ->
                    PersonItem(person, onDelete = { viewModel.removeParticipant(person.id) })
                }
            }
        }
    }

    if (showStartDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = uiState.startDate)
        DatePickerDialog(
            onDismissRequest = { showStartDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.onStartDateChange(datePickerState.selectedDateMillis)
                        showStartDatePicker = false
                    }
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showStartDatePicker = false }) { Text("Cancelar") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showEndDatePicker) {
        val datePickerState = rememberDatePickerState(initialSelectedDateMillis = uiState.endDate)
        DatePickerDialog(
            onDismissRequest = { showEndDatePicker = false },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.onEndDateChange(datePickerState.selectedDateMillis)
                        showEndDatePicker = false
                    }
                ) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showEndDatePicker = false }) { Text("Cancelar") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    if (showDeleteConfirmation) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("Confirmar Exclusão") },
            text = { Text("Você tem certeza que deseja excluir esta viagem? Esta ação não pode ser desfeita.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deleteTrip()
                        showDeleteConfirmation = false
                        navController.popBackStack()
                    }
                ) { Text("Excluir") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) { Text("Cancelar") }
            }
        )
    }

    if (showAddParticipantDialog) {
        AddTripParticipantDialog(
            allPeople = uiState.allPeople,
            onDismiss = { showAddParticipantDialog = false },
            onConfirm = { personId ->
                viewModel.addParticipant(personId)
                showAddParticipantDialog = false
            }
        )
    }
}

@Composable
fun PersonItem(person: Person, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(person.name, fontWeight = FontWeight.Bold)
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Remover Participante")
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTripParticipantDialog(allPeople: List<Person>, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    var selectedPerson by remember { mutableStateOf<Person?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adicionar Participante") },
        text = {
            ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
                OutlinedTextField(
                    value = selectedPerson?.name ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Selecione uma pessoa") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier.menuAnchor().fillMaxWidth()
                )
                ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                    allPeople.forEach { person ->
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
            Button(
                onClick = { selectedPerson?.let { onConfirm(it.id) } },
                enabled = selectedPerson != null
            ) {
                Text("Adicionar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
