package com.example.pe.ui.features.main

import androidx.lifecycle.ViewModel
import com.example.pe.data.local.Transaction
import com.example.pe.data.local.TransactionDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    transactionDao: TransactionDao
) : ViewModel() {

    val transactions: Flow<List<Transaction>> = transactionDao.getAll()

}
