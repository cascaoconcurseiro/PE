package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface DebtParticipantDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(participant: DebtParticipant)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(participants: List<DebtParticipant>)

    @Update
    suspend fun updateAll(participants: List<DebtParticipant>)

    @Delete
    suspend fun delete(participant: DebtParticipant)

    @Query("SELECT * FROM debt_participants")
    fun getAllDebts(): Flow<List<DebtParticipant>>

    @Query("SELECT * FROM debt_participants WHERE sharedDebtId = :debtId")
    fun getParticipantsForDebt(debtId: String): Flow<List<DebtParticipant>>
}
