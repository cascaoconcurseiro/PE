package com.example.pe.domain.model

data class Transaction(
    val id: Int = 0,
    val description: String,
    val amount: Double,
    val date: Long
)
