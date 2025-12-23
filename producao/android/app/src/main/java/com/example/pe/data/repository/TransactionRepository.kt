package com.example.pe.data.repository

import com.example.pe.data.local.dao.TransactionDao
import com.example.pe.domain.mapper.toData
import com.example.pe.domain.mapper.toDomain
import com.example.pe.domain.model.Transaction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

class TransactionRepository @Inject constructor(
    private val transactionDao: TransactionDao
) {
    fun getAllTransactions(): Flow<List<Transaction>> {
        return transactionDao.getAll().map { transactions ->
            transactions.map { it.toDomain() }
        }
    }

    suspend fun insertTransaction(transaction: Transaction) {
        transactionDao.insert(transaction.toData())
    }
}
