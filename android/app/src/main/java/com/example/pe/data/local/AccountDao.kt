package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface AccountDao {
    @Query("SELECT * FROM accounts")
    fun getAll(): Flow<List<Account>>

    @Insert
    suspend fun insert(account: Account)
}
