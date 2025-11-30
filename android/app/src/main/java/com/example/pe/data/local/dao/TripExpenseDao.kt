package com.example.pe.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.example.pe.data.local.model.TripExpense
import kotlinx.coroutines.flow.Flow

@Dao
interface TripExpenseDao {
    @Insert
    suspend fun insert(expense: TripExpense)

    @Update
    suspend fun update(expense: TripExpense)

    @Query("DELETE FROM trip_expenses WHERE id = :expenseId")
    suspend fun delete(expenseId: Int)

    @Query("SELECT * FROM trip_expenses WHERE tripId = :tripId ORDER BY date DESC")
    fun getExpensesForTrip(tripId: Int): Flow<List<TripExpense>>

    @Query("SELECT * FROM trip_expenses WHERE id = :expenseId")
    fun getExpenseById(expenseId: Int): Flow<TripExpense?>
}
