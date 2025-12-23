package com.example.pe.ui.features.accounts

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class AddAccountViewModel @Inject constructor(
    private val accountDao: AccountDao
) : ViewModel() {

    fun saveAccount(name: String, initialBalance: String) {
        viewModelScope.launch {
            val balance = initialBalance.toDoubleOrNull() ?: 0.0
            val newAccount = Account(
                id = UUID.randomUUID().toString(),
                name = name,
                initialBalance = balance
            )
            accountDao.insert(newAccount)
        }
    }
}
