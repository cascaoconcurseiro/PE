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
    
    @Query("""
        SELECT c.name as categoryName, SUM(t.amount) as totalAmount, c.color as color
        FROM transactions t
        INNER JOIN categories c ON t.categoryId = c.id
        WHERE t.amount < 0 -- Only expenses
        GROUP BY c.name
        """)
    fun getSpendingByCategory(): Flow<List<CategorySpending>>

    @Insert
    suspend fun insert(transaction: Transaction)

    @Update
    suspend fun update(transaction: Transaction)

    @Delete
    suspend fun delete(transaction: Transaction)
}
