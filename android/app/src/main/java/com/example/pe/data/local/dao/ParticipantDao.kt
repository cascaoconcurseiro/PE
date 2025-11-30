package com.example.pe.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.example.pe.data.local.model.Participant
import kotlinx.coroutines.flow.Flow

@Dao
interface ParticipantDao {
    @Insert
    suspend fun insert(participant: Participant)

    @Query("DELETE FROM participants WHERE id = :participantId")
    suspend fun delete(participantId: Int)

    @Query("SELECT * FROM participants WHERE tripId = :tripId")
    fun getParticipantsForTrip(tripId: Int): Flow<List<Participant>>
}
