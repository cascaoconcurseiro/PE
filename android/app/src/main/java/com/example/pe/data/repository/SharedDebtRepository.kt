package com.example.pe.data.repository

import com.example.pe.data.local.dao.DebtParticipantDao
import com.example.pe.data.local.dao.SharedDebtDao
import com.example.pe.data.local.model.DebtParticipant
import com.example.pe.data.local.model.SharedDebt
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class SharedDebtRepository @Inject constructor(
    private val sharedDebtDao: SharedDebtDao,
    private val debtParticipantDao: DebtParticipantDao
) {
    // We will add methods here as we need them
    fun getSharedDebtForExpense(expenseId: String): Flow<SharedDebt?> {
        // TODO: Implement in SharedDebtDao
        return sharedDebtDao.getSharedDebtForExpense(expenseId)
    }

    fun getDebtParticipants(sharedDebtId: String): Flow<List<DebtParticipant>> {
        // TODO: Implement in DebtParticipantDao
        return debtParticipantDao.getParticipantsForDebt(sharedDebtId)
    }
}
