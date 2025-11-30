package com.example.pe.data.repository

import com.example.pe.data.local.dao.TripExpenseDao
import com.example.pe.data.local.model.TripExpense
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class TripExpenseRepository @Inject constructor(
    private val tripExpenseDao: TripExpenseDao
) {
    fun getExpensesForTrip(tripId: String): Flow<List<TripExpense>> {
        return tripExpenseDao.getExpensesForTrip(tripId)
    }

    fun getExpenseById(expenseId: String): Flow<TripExpense?> {
        return tripExpenseDao.getExpenseById(expenseId)
    }

    suspend fun insertExpense(expense: TripExpense) {
        tripExpenseDao.insert(expense)
    }

    suspend fun updateExpense(expense: TripExpense) {
        tripExpenseDao.update(expense)
    }

    suspend fun deleteExpense(expenseId: String) {
        tripExpenseDao.delete(expenseId)
    }
}
