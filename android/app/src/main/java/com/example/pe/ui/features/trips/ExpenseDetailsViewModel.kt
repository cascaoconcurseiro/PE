package com.example.pe.ui.features.trips

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Person
import com.example.pe.data.local.model.DebtParticipant
import com.example.pe.data.local.model.SharedDebt
import com.example.pe.data.local.model.SplitType
import com.example.pe.data.local.model.TripExpense
import com.example.pe.data.repository.PersonRepository
import com.example.pe.data.repository.SharedDebtRepository
import com.example.pe.data.repository.TripExpenseRepository
import com.example.pe.data.repository.TripParticipantRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class ExpenseDetailsUiState(
    val expense: TripExpense? = null,
    val allParticipants: List<Person> = emptyList(),
    val debt: SharedDebt? = null,
    val debtParticipants: List<DebtParticipant> = emptyList(),
    val paidBy: Person? = null
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class ExpenseDetailsViewModel @Inject constructor(
    private val tripExpenseRepository: TripExpenseRepository,
    private val tripParticipantRepository: TripParticipantRepository,
    private val personRepository: PersonRepository,
    private val sharedDebtRepository: SharedDebtRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val tripId: String = checkNotNull(savedStateHandle["tripId"])
    private val expenseId: String = checkNotNull(savedStateHandle["expenseId"])

    private val _sharedDebt: Flow<SharedDebt?> = sharedDebtRepository.getSharedDebtForExpense(expenseId)

    val uiState: StateFlow<ExpenseDetailsUiState> = combine(
        tripExpenseRepository.getExpenseById(expenseId),
        tripParticipantRepository.getParticipantsForTrip(tripId).flatMapLatest { tripParticipants ->
            val participantIds = tripParticipants.map { it.personId }
            personRepository.getAllPeople().map { allPeople ->
                allPeople.filter { it.id in participantIds }
            }
        },
        _sharedDebt,
        _sharedDebt.flatMapLatest { debt ->
            if (debt != null) {
                sharedDebtRepository.getDebtParticipants(debt.id)
            } else {
                flowOf(emptyList())
            }
        }
    ) { expense, allParticipants, sharedDebt, debtParticipants ->
        val paidBy = allParticipants.find { it.id == sharedDebt?.paidByPersonId }
        ExpenseDetailsUiState(expense, allParticipants, sharedDebt, debtParticipants, paidBy)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ExpenseDetailsUiState())

    fun setPaidBy(personId: String) {
        viewModelScope.launch {
            val currentDebt = uiState.value.debt
            val debt = currentDebt?.copy(paidByPersonId = personId) ?: SharedDebt(
                id = UUID.randomUUID().toString(),
                transactionId = expenseId,
                paidByPersonId = personId,
                splitType = SplitType.EQUAL
            )
            sharedDebtRepository.insertOrUpdateSharedDebt(debt)
        }
    }

    fun addParticipantToSplit(personId: String) {
        viewModelScope.launch {
            uiState.value.debt?.let {
                val debtParticipant = DebtParticipant(sharedDebtId = it.id, personId = personId, amountOwed = 0.0)
                sharedDebtRepository.addParticipantToSplit(debtParticipant)
            }
        }
    }

    fun removeParticipantFromSplit(personId: String) {
        viewModelScope.launch {
            uiState.value.debt?.let {
                // We need the full DebtParticipant object to delete it
                val participantToDelete = uiState.value.debtParticipants.find { it.personId == personId }
                if(participantToDelete != null) {
                    sharedDebtRepository.removeParticipantFromSplit(participantToDelete)
                }
            }
        }
    }

    fun calculateSplit(splitType: SplitType) {
        // TODO: Implement logic
    }
}
