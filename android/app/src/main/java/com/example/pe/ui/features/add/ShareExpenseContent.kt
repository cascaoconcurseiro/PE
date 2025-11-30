package com.example.pe.ui.features.add

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pe.data.local.Person
import com.example.pe.data.local.SplitType

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareExpenseContent(
    people: List<Person>,
    onParticipantsChange: (List<Person>) -> Unit,
    onPaidByChange: (Person) -> Unit,
    onSplitTypeChange: (SplitType) -> Unit,
    onCustomAmountsChange: (Map<String, Double>) -> Unit
) {
    var paidBy by remember { mutableStateOf<Person?>(null) }
    var isPaidByMenuExpanded by remember { mutableStateOf(false) }
    val selectedParticipants = remember { mutableStateOf(listOf<Person>()) }
    var splitType by remember { mutableStateOf(SplitType.EQUAL) }
    val customAmounts = remember { mutableStateMapOf<String, String>() }

    Column(modifier = Modifier.padding(top = 8.dp)) {
        // Paid By Dropdown
        ExposedDropdownMenuBox(
            expanded = isPaidByMenuExpanded,
            onExpandedChange = { isPaidByMenuExpanded = !isPaidByMenuExpanded },
        ) {
            OutlinedTextField(
                value = paidBy?.name ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("Pago por") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = isPaidByMenuExpanded) },
                modifier = Modifier.menuAnchor().fillMaxWidth()
            )
            ExposedDropdownMenu(
                expanded = isPaidByMenuExpanded,
                onDismissRequest = { isPaidByMenuExpanded = false }
            ) {
                people.forEach { person ->
                    DropdownMenuItem(
                        text = { Text(person.name) },
                        onClick = {
                            paidBy = person
                            onPaidByChange(person)
                            isPaidByMenuExpanded = false
                        }
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Participants Checkboxes
        Text("Dividir com:")
        people.forEach { person ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = selectedParticipants.value.contains(person),
                    onCheckedChange = {
                        val currentSelection = selectedParticipants.value.toMutableList()
                        if (it) {
                            currentSelection.add(person)
                        } else {
                            currentSelection.remove(person)
                            customAmounts.remove(person.id)
                        }
                        selectedParticipants.value = currentSelection
                        onParticipantsChange(currentSelection)
                    }
                )
                Text(person.name)
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Split Type Selection
        Text("Tipo de Divisão:")
        Row(verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = splitType == SplitType.EQUAL, onClick = { splitType = SplitType.EQUAL; onSplitTypeChange(SplitType.EQUAL) })
            Text("Igual")
            RadioButton(selected = splitType == SplitType.VALUE, onClick = { splitType = SplitType.VALUE; onSplitTypeChange(SplitType.VALUE) })
            Text("Valor")
            RadioButton(selected = splitType == SplitType.PERCENTAGE, onClick = { splitType = SplitType.PERCENTAGE; onSplitTypeChange(SplitType.PERCENTAGE) })
            Text("%")
        }

        if (splitType != SplitType.EQUAL) {
            selectedParticipants.value.forEach { participant ->
                OutlinedTextField(
                    value = customAmounts[participant.id] ?: "",
                    onValueChange = {
                        customAmounts[participant.id] = it
                        onCustomAmountsChange(customAmounts.mapValues { entry -> entry.value.toDoubleOrNull() ?: 0.0 })
                    },
                    label = { Text("Valor para ${participant.name}") },
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                )
            }
        }
    }
}
