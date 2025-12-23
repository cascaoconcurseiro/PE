package com.example.pe.ui.features.main

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.ExchangeRateRepository
import com.example.pe.data.local.TransactionDao
import com.example.pe.data.local.TransactionWithCategory
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    transactionDao: TransactionDao,
    exchangeRateRepository: ExchangeRateRepository
) : ViewModel() {

    private val baseCurrency = "BRL"

    val transactions: Flow<List<TransactionWithCategory>> = transactionDao.getAllWithCategory()

    val totalBalance: StateFlow<Double> = transactionDao.getAllWithCategory()
        .map { list ->
            list.sumOf { item ->
                exchangeRateRepository.convert(
                    amount = item.transaction.amount,
                    from = item.transaction.currency,
                    to = baseCurrency
                )
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = 0.0
        )
}
