package com.example.pe.ui.features.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.Category
import com.example.pe.data.local.CategoryDao
import com.example.pe.data.local.Transaction
import com.example.pe.data.local.TransactionDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class AddTransactionViewModel @Inject constructor(
    private val transactionDao: TransactionDao,
    categoryDao: CategoryDao,
    accountDao: AccountDao
) : ViewModel() {

    val categories: StateFlow<List<Category>> = categoryDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val accounts: StateFlow<List<Account>> = accountDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun saveTransaction(description: String, amount: String, categoryId: String, accountId: String) {
        viewModelScope.launch {
            val amountDouble = amount.toDoubleOrNull() ?: 0.0
            val newTransaction = Transaction(
                id = UUID.randomUUID().toString(),
                description = description,
                amount = amountDouble,
                currency = "BRL", // Placeholder
                date = System.currentTimeMillis(),
                categoryId = categoryId,
                accountId = accountId
            )
            transactionDao.insert(newTransaction)
        }
    }
}
