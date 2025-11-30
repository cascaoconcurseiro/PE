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

    fun getSharedDebtForExpense(expenseId: String): Flow<SharedDebt?> {
        return sharedDebtDao.getSharedDebtForExpense(expenseId)
    }

    fun getDebtParticipants(sharedDebtId: String): Flow<List<DebtParticipant>> {
        return debtParticipantDao.getParticipantsForDebt(sharedDebtId)
    }

    suspend fun insertOrUpdateSharedDebt(sharedDebt: SharedDebt) {
        sharedDebtDao.insertOrUpdate(sharedDebt)
    }

    suspend fun addParticipantToSplit(participant: DebtParticipant) {
        debtParticipantDao.insert(participant)
    }

    suspend fun removeParticipantFromSplit(participant: DebtParticipant) {
        debtParticipantDao.delete(participant)
    }
}
