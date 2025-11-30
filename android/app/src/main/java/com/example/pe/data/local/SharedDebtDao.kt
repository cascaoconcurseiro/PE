package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SharedDebtDao {
    @Insert
    suspend fun insert(sharedDebt: SharedDebt)

    @Query("SELECT * FROM shared_debts WHERE id IN (SELECT sharedDebtId FROM debt_participants WHERE personId = :personId)")
    fun getDebtsForPerson(personId: String): Flow<List<SharedDebt>>

    @Query("SELECT * FROM shared_debts WHERE transactionId = :expenseId")
    fun getSharedDebtForExpense(expenseId: String): Flow<SharedDebt?>
}
