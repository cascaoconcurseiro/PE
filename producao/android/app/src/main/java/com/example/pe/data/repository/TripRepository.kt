package com.example.pe.data.repository

import com.example.pe.data.local.dao.TripDao
import com.example.pe.data.local.model.Trip
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class TripRepository @Inject constructor(
    private val tripDao: TripDao
) {
    fun getAllTrips(): Flow<List<Trip>> = tripDao.getAll()

    fun getTripById(tripId: String): Flow<Trip?> = tripDao.getTripById(tripId)

    suspend fun insertTrip(trip: Trip) {
        tripDao.insert(trip)
    }

    suspend fun updateTrip(trip: Trip) {
        tripDao.update(trip)
    }

    suspend fun deleteTrip(tripId: String) {
        tripDao.delete(tripId)
    }
}
