package com.example.pe.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import com.example.pe.data.local.model.ExpenseSplit

@Dao
interface ExpenseSplitDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(expenseSplit: ExpenseSplit)
}
