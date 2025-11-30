package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("""
        SELECT * FROM transactions 
        INNER JOIN categories ON transactions.categoryId = categories.id 
        ORDER BY date DESC
        """)
    fun getAllWithCategory(): Flow<List<TransactionWithCategory>>

    @Query("SELECT * FROM transactions WHERE id = :id")
    fun getById(id: String): Flow<Transaction>

    @Insert
    suspend fun insert(transaction: Transaction)

    @Update
    suspend fun update(transaction: Transaction)

    @Delete
    suspend fun delete(transaction: Transaction)
}
