package com.example.pe.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "trips")
data class Trip(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val destination: String,
    val startDate: Long,
    val endDate: Long,
    val budget: Double,
    val coverImage: String? = null
)
