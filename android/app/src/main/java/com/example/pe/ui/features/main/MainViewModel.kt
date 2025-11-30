package com.example.pe.ui.features.main

import androidx.lifecycle.ViewModel
import com.example.pe.model.Transaction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

class MainViewModel : ViewModel() {

    private val _transactions = MutableStateFlow<List<Transaction>>(emptyList())
    val transactions: StateFlow<List<Transaction>> = _transactions

    init {
        // Load some sample data
        _transactions.value = listOf(
            Transaction("1", "Café", 5.50, "BRL", System.currentTimeMillis(), "1"),
            Transaction("2", "Almoço", 25.00, "BRL", System.currentTimeMillis() - 86400000, "1"),
            Transaction("3", "Uber", 12.75, "BRL", System.currentTimeMillis() - 172800000, "2"),
            Transaction("4", "Supermercado", 150.20, "BRL", System.currentTimeMillis() - 259200000, "1"),
        )
    }
}
