package com.example.pe.ui.features.cards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.Card
import com.example.pe.data.local.CardDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class AddCardViewModel @Inject constructor(
    private val cardDao: CardDao,
    accountDao: AccountDao
) : ViewModel() {

    val accounts: StateFlow<List<Account>> = accountDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun saveCard(name: String, limit: String, closingDay: String, paymentDay: String, accountId: String) {
        viewModelScope.launch {
            val newCard = Card(
                id = UUID.randomUUID().toString(),
                name = name,
                limit = limit.toDoubleOrNull() ?: 0.0,
                closingDay = closingDay.toIntOrNull() ?: 1,
                paymentDay = paymentDay.toIntOrNull() ?: 10,
                accountId = accountId // Account to pay the bill from
            )
            cardDao.insert(newCard)
        }
    }
}
