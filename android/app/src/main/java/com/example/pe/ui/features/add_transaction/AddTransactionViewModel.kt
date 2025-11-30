package com.example.pe.ui.features.add_transaction

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.repository.TransactionRepository
import com.example.pe.domain.model.Transaction
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AddTransactionViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository
) : ViewModel() {

    fun addTransaction(description: String, amount: String) {
        viewModelScope.launch {
            val amountDouble = amount.toDoubleOrNull() ?: 0.0
            val transaction = Transaction(
                description = description,
                amount = amountDouble,
                date = System.currentTimeMillis()
            )
            transactionRepository.insertTransaction(transaction)
        }
    }
}
