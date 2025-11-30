package com.example.pe.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PersonDao {
    @Query("SELECT * FROM people")
    fun getAll(): Flow<List<Person>>

    @Insert
    suspend fun insert(person: Person)
}
