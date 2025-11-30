package com.example.pe.ui.features.trips

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.model.DebtParticipant
import com.example.pe.data.local.model.Participant
import com.example.pe.data.local.model.SharedDebt
import com.example.pe.data.local.model.SplitType
import com.example.pe.data.local.model.TripExpense
import com.example.pe.data.repository.ParticipantRepository
import com.example.pe.data.repository.SharedDebtRepository // Assume this will be created
import com.example.pe.data.repository.TripExpenseRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

data class ExpenseDetailsUiState(
    val expense: TripExpense? = null,
    val allParticipants: List<Participant> = emptyList(), // All participants of the trip
    val debt: SharedDebt? = null,
    val debtParticipants: List<DebtParticipant> = emptyList(), // Participants of this specific debt
    val paidBy: Participant? = null
)

@HiltViewModel
class ExpenseDetailsViewModel @Inject constructor(
    private val tripExpenseRepository: TripExpenseRepository,
    private val participantRepository: ParticipantRepository,
    private val sharedDebtRepository: SharedDebtRepository, // Assume this will be created
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val tripId: Int = checkNotNull(savedStateHandle["tripId"])
    private val expenseId: Int = checkNotNull(savedStateHandle["expenseId"])

    val uiState: StateFlow<ExpenseDetailsUiState> = combine(
        tripExpenseRepository.getExpenseById(expenseId),
        participantRepository.getParticipantsForTrip(tripId),
        sharedDebtRepository.getSharedDebtForExpense(expenseId), // Needs to be created
    ) { expense, allParticipants, sharedDebt ->
        // Further combine needed for debtParticipants and paidBy
        ExpenseDetailsUiState(expense, allParticipants)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), ExpenseDetailsUiState())

    fun setPaidBy(participantId: Int) { 
        // Logic to create/update SharedDebt
    }

    fun addParticipantToSplit(participantId: Int) {
        // Logic to add a DebtParticipant
    }

    fun removeParticipantFromSplit(participantId: Int) {
        // Logic to remove a DebtParticipant
    }

    fun calculateSplit(splitType: SplitType) {
        // Logic to calculate amounts based on split type
    }
}
