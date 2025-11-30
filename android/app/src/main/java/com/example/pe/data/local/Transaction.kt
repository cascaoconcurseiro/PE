package com.example.pe.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "transactions")
data class Transaction(
    @PrimaryKey val id: String,
    val description: String,
    val amount: Double,
    val currency: String,
    val date: Long,
    val categoryId: String
)
