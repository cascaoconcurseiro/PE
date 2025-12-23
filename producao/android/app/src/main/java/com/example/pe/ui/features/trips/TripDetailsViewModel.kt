package com.example.pe.ui.features.trips

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.model.Participant
import com.example.pe.data.local.model.Trip
import com.example.pe.data.local.model.TripExpense
import com.example.pe.data.repository.ParticipantRepository
import com.example.pe.data.repository.TripExpenseRepository
import com.example.pe.data.repository.TripRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

data class TripDetailsUiState(
    val trip: Trip? = null,
    val participants: List<Participant> = emptyList(),
    val expenses: List<TripExpense> = emptyList(),
    val totalExpenses: Double = 0.0
)

@HiltViewModel
class TripDetailsViewModel @Inject constructor(
    tripRepository: TripRepository,
    participantRepository: ParticipantRepository,
    tripExpenseRepository: TripExpenseRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val tripId: Int = checkNotNull(savedStateHandle["tripId"])

    val uiState: StateFlow<TripDetailsUiState> = combine(
        tripRepository.getTripById(tripId),
        participantRepository.getParticipantsForTrip(tripId),
        tripExpenseRepository.getExpensesForTrip(tripId)
    ) { trip, participants, expenses ->
        val totalExpenses = expenses.sumOf { it.amount }
        TripDetailsUiState(trip, participants, expenses, totalExpenses)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = TripDetailsUiState()
    )
}
