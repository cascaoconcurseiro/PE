package com.example.pe.ui.features.cards

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.Card
import com.example.pe.data.local.CardDao
import com.example.pe.ui.SnackbarManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EditCardViewModel @Inject constructor(
    private val cardDao: CardDao,
    accountDao: AccountDao,
    private val snackbarManager: SnackbarManager,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val cardId: String = savedStateHandle.get<String>("cardId")!!

    val card = cardDao.getById(cardId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    val accounts = accountDao.getAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList<Account>())

    fun updateCard(name: String, limit: String, closingDay: String, paymentDay: String, accountId: String) {
        viewModelScope.launch {
            val originalCard = card.value ?: return@launch
            val updatedCard = originalCard.copy(
                name = name,
                limit = limit.toDoubleOrNull() ?: originalCard.limit,
                closingDay = closingDay.toIntOrNull() ?: originalCard.closingDay,
                paymentDay = paymentDay.toIntOrNull() ?: originalCard.paymentDay,
                accountId = accountId
            )
            cardDao.update(updatedCard)
            snackbarManager.showMessage("Cartão atualizado com sucesso")
        }
    }

    fun deleteCard() {
        viewModelScope.launch {
            card.value?.let { 
                cardDao.delete(it)
                snackbarManager.showMessage("Cartão excluído")
            }
        }
    }
}
