package com.example.pe.ui.features.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Transaction
import com.example.pe.data.local.TransactionDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class AddTransactionViewModel @Inject constructor(
    private val transactionDao: TransactionDao
) : ViewModel() {

    fun saveTransaction(description: String, amount: String) {
        viewModelScope.launch {
            val amountDouble = amount.toDoubleOrNull() ?: 0.0
            val newTransaction = Transaction(
                id = UUID.randomUUID().toString(),
                description = description,
                amount = amountDouble,
                currency = "BRL", // Placeholder
                date = System.currentTimeMillis(),
                categoryId = "1" // Placeholder
            )
            transactionDao.insert(newTransaction)
        }
    }
}
