package com.example.pe.ui.features.cards

import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.ui.Routes

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CardsScreen(
    navController: NavController,
    viewModel: CardsViewModel = hiltViewModel()
) {
    val cards by viewModel.cards.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Cartões de Crédito") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { navController.navigate(Routes.ADD_CARD) }) {
                Icon(Icons.Filled.Add, contentDescription = "Adicionar Cartão")
            }
        }
    ) { innerPadding ->
        LazyColumn(modifier = Modifier.padding(innerPadding)) {
            items(cards) { card ->
                CardItem(
                    card = card, 
                    onClick = { navController.navigate("${Routes.EDIT_CARD}/${card.id}") }
                )
            }
        }
    }
}
