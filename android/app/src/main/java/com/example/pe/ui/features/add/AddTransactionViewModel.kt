package com.example.pe.ui.features.add

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.Card
import com.example.pe.data.local.CardDao
import com.example.pe.data.local.Category
import com.example.pe.data.local.CategoryDao
import com.example.pe.data.local.DebtParticipant
import com.example.pe.data.local.DebtParticipantDao
import com.example.pe.data.local.Person
import com.example.pe.data.local.PersonDao
import com.example.pe.data.local.SharedDebt
import com.example.pe.data.local.SharedDebtDao
import com.example.pe.data.local.SplitType
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
    private val sharedDebtDao: SharedDebtDao,
    private val debtParticipantDao: DebtParticipantDao,
    categoryDao: CategoryDao,
    accountDao: AccountDao,
    cardDao: CardDao,
    personDao: PersonDao
) : ViewModel() {

    val categories: StateFlow<List<Category>> = categoryDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val accounts: StateFlow<List<Account>> = accountDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cards: StateFlow<List<Card>> = cardDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
        
    val people: StateFlow<List<Person>> = personDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun saveTransaction(
        description: String, 
        amount: String, 
        currency: String,
        categoryId: String, 
        paymentType: PaymentType,
        accountId: String?,
        cardId: String?,
        isShared: Boolean,
        paidByPersonId: String?,
        participants: List<Person>,
        splitType: SplitType,
        customAmounts: Map<String, Double>
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

            if (isShared && paidByPersonId != null && participants.isNotEmpty()) {
                val sharedDebtId = UUID.randomUUID().toString()
                val newSharedDebt = SharedDebt(
                    id = sharedDebtId,
                    transactionId = newTransaction.id,
                    paidByPersonId = paidByPersonId,
                    splitType = splitType
                )
                sharedDebtDao.insert(newSharedDebt)

                val debtParticipants = participants.map { person ->
                    val amountOwed = when (splitType) {
                        SplitType.EQUAL -> amountDouble / participants.size
                        SplitType.VALUE -> customAmounts[person.id] ?: 0.0
                        SplitType.PERCENTAGE -> (customAmounts[person.id] ?: 0.0) / 100 * amountDouble
                    }
                    DebtParticipant(
                        sharedDebtId = sharedDebtId,
                        personId = person.id,
                        amountOwed = amountOwed,
                        hasPaid = person.id == paidByPersonId
                    )
                }
                debtParticipantDao.insertAll(debtParticipants)
            }
        }
    }
}
