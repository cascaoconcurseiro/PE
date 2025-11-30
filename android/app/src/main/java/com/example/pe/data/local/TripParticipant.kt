package com.example.pe.data.local

import androidx.room.Entity
import androidx.room.ForeignKey

@Entity(
    tableName = "trip_participants",
    primaryKeys = ["tripId", "personId"],
    foreignKeys = [
        ForeignKey(
            entity = Trip::class,
            parentColumns = ["id"],
            childColumns = ["tripId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Person::class,
            parentColumns = ["id"],
            childColumns = ["personId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class TripParticipant(
    val tripId: String,
    val personId: String
)
