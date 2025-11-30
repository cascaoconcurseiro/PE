package com.example.pe.data.local.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(
    tableName = "trip_expenses",
    foreignKeys = [
        ForeignKey(
            entity = Trip::class,
            parentColumns = ["id"],
            childColumns = ["tripId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class TripExpense(
    @PrimaryKey
    val id: String = UUID.randomUUID().toString(),
    val tripId: String,
    val name: String,
    val category: String,
    val amount: Double,
    val date: Long,
    val paymentMethod: String,
    val attachmentUri: String? = null
)
