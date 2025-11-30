package com.example.pe.ui.features.edit

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.CategoryDao
import com.example.pe.data.local.Transaction
import com.example.pe.data.local.TransactionDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EditTransactionViewModel @Inject constructor(
    private val transactionDao: TransactionDao,
    categoryDao: CategoryDao,
    accountDao: AccountDao,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val transactionId: String = savedStateHandle.get<String>("transactionId")!!

    val transaction = transactionDao.getById(transactionId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val categories = categoryDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val accounts = accountDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun updateTransaction(description: String, amount: String, categoryId: String, accountId: String) {
        viewModelScope.launch {
            val originalTransaction = transaction.value ?: return@launch
            val updatedTransaction = originalTransaction.copy(
                description = description,
                amount = amount.toDoubleOrNull() ?: originalTransaction.amount,
                categoryId = categoryId,
                accountId = accountId
            )
            transactionDao.update(updatedTransaction)
        }
    }

    fun deleteTransaction() {
        viewModelScope.launch {
            transaction.value?.let { transactionDao.delete(it) }
        }
    }
}
