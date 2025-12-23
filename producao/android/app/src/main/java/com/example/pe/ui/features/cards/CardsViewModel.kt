package com.example.pe.ui.features.cards

import androidx.lifecycle.ViewModel
import com.example.pe.data.local.Card
import com.example.pe.data.local.CardDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

@HiltViewModel
class CardsViewModel @Inject constructor(
    cardDao: CardDao
) : ViewModel() {

    val cards: Flow<List<Card>> = cardDao.getAll()
}
