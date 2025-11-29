package com.example.pe.ui.features.main

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.example.pe.model.Transaction

@Composable
fun TransactionItem(transaction: Transaction) {
    Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(text = transaction.description, modifier = Modifier.weight(1f))
        Text(text = "R$ %.2f".format(transaction.amount))
    }
}
