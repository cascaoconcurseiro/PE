package com.example.pe.ui.features.trips

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Card
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.pe.data.local.model.Trip
import com.example.pe.navigation.Screen

@Composable
fun TripItem(trip: Trip, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = trip.name,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Row {
                Text(text = "De: ${trip.startDate.toFormattedDate()}")
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = "Até: ${trip.endDate.toFormattedDate()}")
            }
            Text(text = "Orçamento: R$ ${trip.budget}")
        }
    }
}

@Composable
fun TripsScreen(navController: NavController, viewModel: TripsViewModel = hiltViewModel()) {
    val trips by viewModel.trips.collectAsState()

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(onClick = { navController.navigate(Screen.CreateEditTrip.createRoute()) }) {
                Icon(Icons.Filled.Add, contentDescription = "Criar Viagem")
            }
        }
    ) { innerPadding ->
        if (trips.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "Nenhuma viagem cadastrada.")
            }
        } else {
            LazyColumn(modifier = Modifier.padding(innerPadding).padding(vertical = 8.dp)) {
                items(trips) { trip ->
                    TripItem(trip = trip) {
                        navController.navigate(Screen.TripDetails.createRoute(trip.id))
                    }
                }
            }
        }
    }
}
