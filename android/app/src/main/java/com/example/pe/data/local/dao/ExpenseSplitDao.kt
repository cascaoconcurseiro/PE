package com.example.pe.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.example.pe.data.local.model.ExpenseSplit
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseSplitDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(splits: List<ExpenseSplit>)

    @Query("SELECT * FROM expense_splits WHERE tripExpenseId = :tripExpenseId")
    fun getSplitsForExpense(tripExpenseId: Int): Flow<List<ExpenseSplit>>

    @Query("DELETE FROM expense_splits WHERE tripExpenseId = :tripExpenseId")
    suspend fun deleteSplitsForExpense(tripExpenseId: Int)
}
