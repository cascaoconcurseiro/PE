package com.example.pe.data.local

import androidx.room.Embedded
import androidx.room.Relation
import com.example.pe.data.local.model.Category
import com.example.pe.data.local.model.Transaction

data class TransactionWithCategory(
    @Embedded val transaction: Transaction,
    @Relation(
        parentColumn = "categoryId",
        entityColumn = "id"
    )
    val category: Category
)
