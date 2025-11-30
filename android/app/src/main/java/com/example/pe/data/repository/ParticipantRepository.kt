package com.example.pe.data.repository

import com.example.pe.data.local.dao.ParticipantDao
import com.example.pe.data.local.model.Participant
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class ParticipantRepository @Inject constructor(
    private val participantDao: ParticipantDao
) {
    fun getParticipantsForTrip(tripId: Int): Flow<List<Participant>> {
        return participantDao.getParticipantsForTrip(tripId)
    }

    suspend fun insertParticipant(participant: Participant) {
        participantDao.insert(participant)
    }

    suspend fun deleteParticipant(participantId: Int) {
        participantDao.delete(participantId)
    }
}
