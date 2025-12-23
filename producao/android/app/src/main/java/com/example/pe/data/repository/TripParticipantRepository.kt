package com.example.pe.data.repository

import com.example.pe.data.local.dao.TripParticipantDao
import com.example.pe.data.local.model.TripParticipant
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class TripParticipantRepository @Inject constructor(
    private val tripParticipantDao: TripParticipantDao
) {
    fun getParticipantsForTrip(tripId: String): Flow<List<TripParticipant>> {
        return tripParticipantDao.getParticipantsForTrip(tripId)
    }

    suspend fun insert(tripParticipant: TripParticipant) {
        tripParticipantDao.insert(tripParticipant)
    }

    suspend fun delete(tripId: String, personId: String) {
        tripParticipantDao.delete(tripId, personId)
    }
}
