package com.example.pe.model

data class Transaction(
    val id: String,
    val description: String,
    val amount: Double,
    val currency: String,
    val date: Long,
    val categoryId: String
)
