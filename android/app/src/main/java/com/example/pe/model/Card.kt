package com.example.pe.model

data class Card(
    val id: String,
    val name: String,
    val closingDay: Int,
    val paymentDay: Int,
    val limit: Double,
    val accountId: String
)
