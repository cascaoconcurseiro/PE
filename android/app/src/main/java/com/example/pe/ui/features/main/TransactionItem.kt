package com.example.pe.ui.features.main

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.pe.data.local.TransactionWithCategory
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun TransactionItem(
    transactionWithCategory: TransactionWithCategory,
    onClick: () -> Unit
) {
    val transaction = transactionWithCategory.transaction
    val category = transactionWithCategory.category
    val formattedDate = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(transaction.date)

    Row(
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(Color(android.graphics.Color.parseColor(category.color)).copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            // TODO: Replace with dynamic icons based on category.icon
            Icon(Icons.Default.Fastfood, contentDescription = category.name, tint = Color(android.graphics.Color.parseColor(category.color)))
        }
        
        Spacer(modifier = Modifier.width(16.dp))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(text = transaction.description, style = MaterialTheme.typography.bodyLarge)
            Text(text = formattedDate, style = MaterialTheme.typography.bodySmall)
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "${transaction.currency} %.2f".format(transaction.amount),
                style = MaterialTheme.typography.bodyLarge,
                color = if (transaction.amount >= 0) Color(0xFF2E7D32) else Color(0xFFC62828) // Green for income, Red for expense
            )
            if (transaction.currency != "BRL") {
                // TODO: Show converted value
            }
        }
    }
}
