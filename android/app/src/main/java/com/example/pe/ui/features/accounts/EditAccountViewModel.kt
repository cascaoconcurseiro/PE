package com.example.pe.ui.features.accounts

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.ui.SnackbarManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class EditAccountViewModel @Inject constructor(
    private val accountDao: AccountDao,
    private val snackbarManager: SnackbarManager,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val accountId: String = savedStateHandle.get<String>("accountId")!!

    val account = accountDao.getById(accountId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), null)

    fun updateAccount(name: String, initialBalance: String) {
        viewModelScope.launch {
            val originalAccount = account.value ?: return@launch
            val updatedAccount = originalAccount.copy(
                name = name,
                initialBalance = initialBalance.toDoubleOrNull() ?: originalAccount.initialBalance
            )
            accountDao.update(updatedAccount)
            snackbarManager.showMessage("Conta atualizada com sucesso")
        }
    }

    fun deleteAccount() {
        viewModelScope.launch {
            account.value?.let { 
                accountDao.delete(it)
                snackbarManager.showMessage("Conta excluída")
            }
        }
    }
}
