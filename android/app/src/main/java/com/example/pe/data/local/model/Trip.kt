package com.example.pe.data.local.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "trips")
data class Trip(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val name: String,
    val destination: String,
    val startDate: Long,
    val endDate: Long,
    val budget: Double,
    val coverImage: String? = null // Path to the image
)
