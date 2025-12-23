package com.example.pe.ui.features.reports

import androidx.lifecycle.ViewModel
import com.example.pe.data.local.CategorySpending
import com.example.pe.data.local.TransactionDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class ReportsViewModel @Inject constructor(
    transactionDao: TransactionDao
) : ViewModel() {

    val spendingByCategory: Flow<List<CategorySpending>> = transactionDao.getSpendingByCategory()
}
