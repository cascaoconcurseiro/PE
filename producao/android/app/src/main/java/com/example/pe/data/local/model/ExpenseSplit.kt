package com.example.pe.data.local.model

import androidx.room.Entity
import androidx.room.ForeignKey

@Entity(
    tableName = "expense_splits",
    primaryKeys = ["tripExpenseId", "participantId"],
    foreignKeys = [
        ForeignKey(
            entity = TripExpense::class,
            parentColumns = ["id"],
            childColumns = ["tripExpenseId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = Person::class,
            parentColumns = ["id"],
            childColumns = ["participantId"],
            onDelete = ForeignKey.CASCADE
        )
    ]
)
data class ExpenseSplit(
    val tripExpenseId: String,
    val participantId: String,
    val amountOwed: Double
)
