package com.example.pe.data.local

import androidx.room.Embedded
import com.example.pe.data.local.model.Category
import com.example.pe.data.local.model.Transaction

data class TransactionWithCategory(
    @Embedded val transaction: Transaction,
    @Embedded val category: Category
)
