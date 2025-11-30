package com.example.pe.ui.features.trips

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Person
import com.example.pe.data.local.model.Trip
import com.example.pe.data.local.model.TripParticipant
import com.example.pe.data.repository.PersonRepository
import com.example.pe.data.repository.TripParticipantRepository
import com.example.pe.data.repository.TripRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CreateEditTripUiState(
    val id: String? = null,
    val name: String = "",
    val destination: String = "",
    val startDate: Long? = null,
    val endDate: Long? = null,
    val budget: String = "",
    val participants: List<Person> = emptyList(),
    val allPeople: List<Person> = emptyList()
)

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CreateEditTripViewModel @Inject constructor(
    private val tripRepository: TripRepository,
    private val personRepository: PersonRepository,
    private val tripParticipantRepository: TripParticipantRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val tripId: String? = savedStateHandle.get("tripId")

    private val _tripState = MutableStateFlow(CreateEditTripUiState())

    val uiState: StateFlow<CreateEditTripUiState> = combine(
        _tripState,
        personRepository.getAllPeople(),
        tripParticipantRepository.getParticipantsForTrip(tripId ?: "").flatMapLatest { tripParticipants ->
            val participantIds = tripParticipants.map { it.personId }
            personRepository.getAllPeople().map { allPeople ->
                allPeople.filter { it.id in participantIds }
            }
        }
    ) { tripState, allPeople, participants ->
        tripState.copy(
            allPeople = allPeople,
            participants = participants
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), CreateEditTripUiState())

    init {
        if (tripId != null) {
            viewModelScope.launch {
                tripRepository.getTripById(tripId).collect { trip ->
                    trip?.let {
                        _tripState.update {
                            it.copy(
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
                id = currentState.id ?: UUID.randomUUID().toString(),
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

    fun addParticipant(personId: String) {
        viewModelScope.launch {
            val tripId = uiState.value.id ?: return@launch
            val tripParticipant = TripParticipant(tripId = tripId, personId = personId)
            tripParticipantRepository.insert(tripParticipant)
        }
    }

    fun removeParticipant(personId: String) {
        viewModelScope.launch {
            val tripId = uiState.value.id ?: return@launch
            tripParticipantRepository.delete(tripId, personId)
        }
    }
}
