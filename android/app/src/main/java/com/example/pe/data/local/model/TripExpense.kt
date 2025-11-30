package com.example.pe.data.local.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey

@Entity(
    tableName = "trip_expenses",
    foreignKeys = [
        ForeignKey(
            entity = Trip::class,
            parentColumns = ["id"],
            childColumns = ["tripId"],
            onDelete = ForeignKey.CASCADE // Se a viagem for excluída, seus gastos também serão.
        )
    ]
)
data class TripExpense(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val tripId: Int,
    val name: String,
    val category: String,
    val amount: Double,
    val date: Long,
    val paymentMethod: String,
    val attachmentUri: String? = null // URI para foto, PDF, etc.
)
