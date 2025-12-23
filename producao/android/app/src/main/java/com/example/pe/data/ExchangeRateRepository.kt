package com.example.pe.data

import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ExchangeRateRepository @Inject constructor() {

    // Hardcoded rates for now. In the future, this can be fetched from an API.
    private val rates = mapOf(
        "USD" to 5.3,
        "EUR" to 5.7,
        "BRL" to 1.0
    )

    fun getRate(from: String, to: String): Double {
        if (from == to) return 1.0
        // For simplicity, we assume all conversions go through BRL.
        val fromRate = rates[from.uppercase()] ?: 1.0
        val toRate = rates[to.uppercase()] ?: 1.0
        return fromRate / toRate
    }

    fun convert(amount: Double, from: String, to: String): Double {
        return amount * getRate(from, to)
    }
}
