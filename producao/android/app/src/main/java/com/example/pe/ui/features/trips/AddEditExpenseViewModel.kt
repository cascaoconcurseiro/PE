package com.example.pe.ui.features.trips

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.model.TripExpense
import com.example.pe.data.repository.TripExpenseRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AddEditExpenseUiState(
    val id: Int? = null,
    val tripId: Int,
    val name: String = "",
    val category: String = "",
    val amount: String = "",
    val date: Long = System.currentTimeMillis(),
    val paymentMethod: String = ""
)

@HiltViewModel
class AddEditExpenseViewModel @Inject constructor(
    private val expenseRepository: TripExpenseRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val tripId: Int = checkNotNull(savedStateHandle["tripId"])
    private val expenseId: String? = savedStateHandle["expenseId"]

    private val _uiState = MutableStateFlow(AddEditExpenseUiState(tripId = tripId))
    val uiState = _uiState.asStateFlow()

    init {
        if (expenseId != null) {
            viewModelScope.launch {
                expenseRepository.getExpenseById(expenseId.toInt()).first()?.let { expense ->
                    _uiState.value = AddEditExpenseUiState(
                        id = expense.id,
                        tripId = expense.tripId,
                        name = expense.name,
                        category = expense.category,
                        amount = expense.amount.toString(),
                        date = expense.date,
                        paymentMethod = expense.paymentMethod
                    )
                }
            }
        }
    }

    fun onNameChange(name: String) {
        _uiState.update { it.copy(name = name) }
    }

    fun onCategoryChange(category: String) {
        _uiState.update { it.copy(category = category) }
    }

    fun onAmountChange(amount: String) {
        _uiState.update { it.copy(amount = amount) }
    }

    fun onDateChange(date: Long) {
        _uiState.update { it.copy(date = date) }
    }

    fun onPaymentMethodChange(paymentMethod: String) {
        _uiState.update { it.copy(paymentMethod = paymentMethod) }
    }

    fun saveExpense() {
        viewModelScope.launch {
            val currentState = _uiState.value
            val expense = TripExpense(
                id = currentState.id ?: 0,
                tripId = currentState.tripId,
                name = currentState.name,
                category = currentState.category,
                amount = currentState.amount.toDoubleOrNull() ?: 0.0,
                date = currentState.date,
                paymentMethod = currentState.paymentMethod
            )
            if (currentState.id == null) {
                expenseRepository.insertExpense(expense)
            } else {
                expenseRepository.updateExpense(expense)
            }
        }
    }

    fun deleteExpense() {
        viewModelScope.launch {
            _uiState.value.id?.let {
                expenseRepository.deleteExpense(it)
            }
        }
    }
}
