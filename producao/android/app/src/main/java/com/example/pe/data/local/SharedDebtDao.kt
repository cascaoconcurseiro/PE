package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface SharedDebtDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(sharedDebt: SharedDebt)

    @Update
    suspend fun update(sharedDebt: SharedDebt)

    @Query("SELECT * FROM shared_debts WHERE id IN (SELECT sharedDebtId FROM debt_participants WHERE personId = :personId)")
    fun getDebtsForPerson(personId: String): Flow<List<SharedDebt>>

    @Query("SELECT * FROM shared_debts WHERE transactionId = :expenseId")
    fun getSharedDebtForExpense(expenseId: String): Flow<SharedDebt?>
}
