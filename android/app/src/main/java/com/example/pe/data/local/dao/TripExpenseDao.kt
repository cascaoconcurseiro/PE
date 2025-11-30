package com.example.pe.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.pe.data.local.model.TripExpense
import kotlinx.coroutines.flow.Flow

@Dao
interface TripExpenseDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(tripExpense: TripExpense)

    @Query("SELECT * FROM trip_expenses WHERE tripId = :tripId")
    fun getExpensesForTrip(tripId: String): Flow<List<TripExpense>>
}
