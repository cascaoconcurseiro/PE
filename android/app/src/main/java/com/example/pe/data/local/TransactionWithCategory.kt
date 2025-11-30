package com.example.pe.data.local

import androidx.room.Embedded

data class TransactionWithCategory(
    @Embedded val transaction: Transaction,
    @Embedded val category: Category
)
