package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface CardDao {
    @Query("SELECT * FROM cards")
    fun getAll(): Flow<List<Card>>

    @Query("SELECT * FROM cards WHERE id = :id")
    fun getById(id: String): Flow<Card>

    @Insert
    suspend fun insert(card: Card)

    @Update
    suspend fun update(card: Card)

    @Delete
    suspend fun delete(card: Card)
}
