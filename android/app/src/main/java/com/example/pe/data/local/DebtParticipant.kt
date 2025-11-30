package com.example.pe.data.local

import androidx.room.Entity

@Entity(tableName = "debt_participants", primaryKeys = ["sharedDebtId", "personId"])
data class DebtParticipant(
    val sharedDebtId: String,
    val personId: String,
    val amountOwed: Double, // Amount this person owes for this specific debt
    val hasPaid: Boolean = false
)
