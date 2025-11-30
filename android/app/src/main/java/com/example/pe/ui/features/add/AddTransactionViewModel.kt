package com.example.pe.ui.features.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.Card
import com.example.pe.data.local.CardDao
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

enum class PaymentType { DEBIT, CREDIT }

@HiltViewModel
class AddTransactionViewModel @Inject constructor(
    private val transactionDao: TransactionDao,
    categoryDao: CategoryDao,
    accountDao: AccountDao,
    cardDao: CardDao
) : ViewModel() {

    val categories: StateFlow<List<Category>> = categoryDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val accounts: StateFlow<List<Account>> = accountDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cards: StateFlow<List<Card>> = cardDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun saveTransaction(
        description: String, 
        amount: String, 
        currency: String,
        categoryId: String, 
        paymentType: PaymentType,
        accountId: String?,
        cardId: String?
    ) {
        viewModelScope.launch {
            val amountDouble = amount.toDoubleOrNull() ?: 0.0
            val newTransaction = Transaction(
                id = UUID.randomUUID().toString(),
                description = description,
                amount = amountDouble,
                currency = currency.uppercase(),
                date = System.currentTimeMillis(),
                categoryId = categoryId,
                accountId = if (paymentType == PaymentType.DEBIT) accountId else null,
                cardId = if (paymentType == PaymentType.CREDIT) cardId else null
            )
            transactionDao.insert(newTransaction)
        }
    }
}
