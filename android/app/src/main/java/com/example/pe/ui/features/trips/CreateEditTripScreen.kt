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
import androidx.compose.material3.ExperimentalMaterial3Api
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
import com.example.pe.data.local.model.Participant
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

fun Long.toFormattedDate(): String {
    val date = Date(this)
    val format = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
    return format.format(date)
}

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

                items(uiState.participants) { participant ->
                    ParticipantItem(participant, onDelete = { viewModel.deleteParticipant(participant.id) })
                }
            }
        }
    }

    if (showStartDatePicker) { /* ... Date picker dialogs ... */ }
    if (showEndDatePicker) { /* ... Date picker dialogs ... */ }
    if (showDeleteConfirmation) { /* ... Delete confirmation dialog ... */ }
    if (showAddParticipantDialog) {
        AddParticipantDialog(
            onDismiss = { showAddParticipantDialog = false },
            onConfirm = { name, email ->
                viewModel.addParticipant(name, email)
                showAddParticipantDialog = false
            }
        )
    }
}

@Composable
fun ParticipantItem(participant: Participant, onDelete: () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(participant.name, fontWeight = FontWeight.Bold)
                Text(participant.email, style = MaterialTheme.typography.bodySmall)
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Default.Delete, contentDescription = "Remover Participante")
            }
        }
    }
}

@Composable
fun AddParticipantDialog(onDismiss: () -> Unit, onConfirm: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Adicionar Participante") },
        text = {
            Column {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Nome") }
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("E-mail") }
                )
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(name, email) }) {
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
