package com.example.pe.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class SplitType { EQUAL, PERCENTAGE, VALUE }

@Entity(tableName = "shared_debts")
data class SharedDebt(
    @PrimaryKey val id: String,
    val transactionId: String, // The original expense transaction
    val paidByPersonId: String, // Who paid the bill
    val splitType: SplitType
)
