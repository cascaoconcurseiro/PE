package com.example.pe.ui.features.cards

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pe.data.local.Card

@Composable
fun CardItem(
    card: Card,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(Icons.Default.CreditCard, contentDescription = "Card Icon", modifier = Modifier.padding(end = 16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = card.name, style = MaterialTheme.typography.bodyLarge)
            Text(text = "Limite: R$ %.2f".format(card.limit), style = MaterialTheme.typography.bodySmall)
            Text(text = "Vencimento: dia ${card.paymentDay}", style = MaterialTheme.typography.bodySmall)
        }
    }
}
