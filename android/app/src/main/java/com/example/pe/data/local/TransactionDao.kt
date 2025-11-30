package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("""
        SELECT * FROM transactions 
        INNER JOIN categories ON transactions.categoryId = categories.id 
        ORDER BY date DESC
        """)
    fun getAllWithCategory(): Flow<List<TransactionWithCategory>>

    @Insert
    suspend fun insert(transaction: Transaction)
}
