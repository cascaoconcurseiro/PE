package com.example.pe.ui.features.trips

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.model.Participant
import com.example.pe.data.local.model.Trip
import com.example.pe.data.repository.ParticipantRepository
import com.example.pe.data.repository.TripRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CreateEditTripUiState(
    val id: Int? = null,
    val name: String = "",
    val destination: String = "",
    val startDate: Long? = null,
    val endDate: Long? = null,
    val budget: String = "",
    val participants: List<Participant> = emptyList()
)

@HiltViewModel
class CreateEditTripViewModel @Inject constructor(
    private val tripRepository: TripRepository,
    private val participantRepository: ParticipantRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val tripId: String? = savedStateHandle.get("tripId")

    private val _tripState = MutableStateFlow(CreateEditTripUiState())

    val uiState = combine(
        _tripState,
        participantRepository.getParticipantsForTrip(tripId?.toInt() ?: -1)
    ) { tripState, participants ->
        tripState.copy(participants = participants)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), _tripState.value)

    init {
        if (tripId != null) {
            viewModelScope.launch {
                tripRepository.getTripById(tripId.toInt()).first()?.let { trip ->
                    _tripState.value = CreateEditTripUiState(
                        id = trip.id,
                        name = trip.name,
                        destination = trip.destination,
                        startDate = trip.startDate,
                        endDate = trip.endDate,
                        budget = trip.budget.toString()
                    )
                }
            }
        }
    }

    fun onNameChange(name: String) {
        _tripState.update { it.copy(name = name) }
    }

    fun onDestinationChange(destination: String) {
        _tripState.update { it.copy(destination = destination) }
    }

    fun onStartDateChange(date: Long?) {
        _tripState.update { it.copy(startDate = date) }
    }

    fun onEndDateChange(date: Long?) {
        _tripState.update { it.copy(endDate = date) }
    }

    fun onBudgetChange(budget: String) {
        _tripState.update { it.copy(budget = budget) }
    }

    fun saveTrip() {
        viewModelScope.launch {
            val currentState = uiState.value
            val trip = Trip(
                id = currentState.id ?: 0,
                name = currentState.name,
                destination = currentState.destination,
                startDate = currentState.startDate ?: 0L,
                endDate = currentState.endDate ?: 0L,
                budget = currentState.budget.toDoubleOrNull() ?: 0.0
            )
            if (currentState.id == null) {
                tripRepository.insertTrip(trip)
            } else {
                tripRepository.updateTrip(trip)
            }
        }
    }

    fun deleteTrip() {
        viewModelScope.launch {
            uiState.value.id?.let {
                tripRepository.deleteTrip(it)
            }
        }
    }

    fun addParticipant(name: String, email: String) {
        viewModelScope.launch {
            val tripId = uiState.value.id ?: return@launch
            val participant = Participant(tripId = tripId, name = name, email = email)
            participantRepository.insertParticipant(participant)
        }
    }

    fun deleteParticipant(participantId: Int) {
        viewModelScope.launch {
            participantRepository.deleteParticipant(participantId)
        }
    }
}
