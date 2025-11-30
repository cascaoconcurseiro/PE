package com.example.pe.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import com.example.pe.data.local.model.Trip
import kotlinx.coroutines.flow.Flow

@Dao
interface TripDao {
    @Insert
    suspend fun insert(trip: Trip)

    @Update
    suspend fun update(trip: Trip)

    @Query("SELECT * FROM trips ORDER BY startDate DESC")
    fun getAll(): Flow<List<Trip>>

    @Query("SELECT * FROM trips WHERE id = :tripId")
    fun getTripById(tripId: Int): Flow<Trip?>

    @Query("DELETE FROM trips WHERE id = :tripId")
    suspend fun delete(tripId: Int)
}
