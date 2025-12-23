package com.example.pe.ui.features.accounts

import androidx.lifecycle.ViewModel
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class AccountsViewModel @Inject constructor(
    accountDao: AccountDao
) : ViewModel() {

    val accounts: Flow<List<Account>> = accountDao.getAll()
}
