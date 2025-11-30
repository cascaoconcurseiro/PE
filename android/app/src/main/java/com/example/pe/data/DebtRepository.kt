package com.example.pe.data

import com.example.pe.data.local.DebtParticipantDao
import com.example.pe.data.local.Person
import com.example.pe.data.local.PersonDao
import com.example.pe.data.local.SharedDebtDao
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import javax.inject.Inject
import javax.inject.Singleton

data class PersonWithBalance(val person: Person, val balance: Double)

@Singleton
class DebtRepository @Inject constructor(
    private val personDao: PersonDao,
    private val sharedDebtDao: SharedDebtDao,
    private val debtParticipantDao: DebtParticipantDao
) {

    // This is a simplified version. A real implementation would need to handle currencies.
    fun getBalances(currentUserId: String): Flow<List<PersonWithBalance>> {
        // This is a placeholder. A real implementation would query the database
        // and calculate the balance for each person relative to the current user.
        return personDao.getAll().combine(debtParticipantDao.getAllDebts()) { people, allDebts ->
            val currentUserDebts = allDebts.filter { it.personId == currentUserId }
            val otherPeople = people.filter { it.id != currentUserId }

            otherPeople.map { person ->
                val debtsWithPerson = allDebts.filter { it.personId == person.id }

                // Simplified balance calculation
                val iOwe = debtsWithPerson.filter { !it.hasPaid }.sumOf { it.amountOwed }
                val theyOwe = currentUserDebts.filter { !it.hasPaid && it.sharedDebtId in debtsWithPerson.map { d -> d.sharedDebtId } }.sumOf { it.amountOwed }

                PersonWithBalance(person, theyOwe - iOwe)
            }
        }
    }
}
