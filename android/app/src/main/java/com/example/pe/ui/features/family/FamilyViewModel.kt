package com.example.pe.ui.features.family

import androidx.lifecycle.ViewModel
import com.example.pe.data.DebtRepository
import com.example.pe.data.PersonWithBalance
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class FamilyViewModel @Inject constructor(
    debtRepository: DebtRepository
) : ViewModel() {

    // Placeholder for the current user's ID. In a real app, this would come from a login system.
    private val currentUserId = "a1b2c3d4-e5f6-7890-1234-567890abcdef"

    val balances: Flow<List<PersonWithBalance>> = debtRepository.getBalances(currentUserId)
}
