package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface DebtParticipantDao {
    @Insert
    suspend fun insertAll(participants: List<DebtParticipant>)

    @Query("SELECT * FROM debt_participants")
    fun getAllDebts(): Flow<List<DebtParticipant>>
}
