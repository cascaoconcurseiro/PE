package com.example.pe.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "cards")
data class Card(
    @PrimaryKey val id: String,
    val name: String,
    val closingDay: Int,
    val paymentDay: Int,
    val limit: Double,
    val accountId: String
)
