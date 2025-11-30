package com.example.pe.ui.features.reports

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReportsScreen(viewModel: ReportsViewModel = hiltViewModel()) {
    val spendingByCategory by viewModel.spendingByCategory.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Relatórios de Despesas") })
        }
    ) { innerPadding ->
        Column(modifier = Modifier.padding(innerPadding).padding(16.dp)) {
            if (spendingByCategory.isNotEmpty()) {
                val totalSpending = spendingByCategory.sumOf { it.totalAmount }
                PieChart(spendingData = spendingByCategory, totalSpending = totalSpending)
                Spacer(modifier = Modifier.height(16.dp))
                SpendingLegend(spendingData = spendingByCategory)
            } else {
                Text(text = "Nenhuma despesa registrada para exibir.")
            }
        }
    }
}

@Composable
private fun PieChart(spendingData: List<com.example.pe.data.local.CategorySpending>, totalSpending: Double) {
    Box(modifier = Modifier.size(200.dp).padding(16.dp), contentAlignment = Alignment.Center) {
        var startAngle = -90f
        spendingData.forEach { categorySpending ->
            val sweepAngle = (categorySpending.totalAmount / totalSpending).toFloat() * 360f
            Canvas(modifier = Modifier.size(200.dp)) {
                drawArc(
                    color = Color(android.graphics.Color.parseColor(categorySpending.color)),
                    startAngle = startAngle,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    style = Stroke(width = 50f, cap = StrokeCap.Butt)
                )
            }
            startAngle += sweepAngle
        }
    }
}

@Composable
private fun SpendingLegend(spendingData: List<com.example.pe.data.local.CategorySpending>) {
    Column {
        spendingData.forEach { categorySpending ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(16.dp).background(Color(android.graphics.Color.parseColor(categorySpending.color))))
                Spacer(modifier = Modifier.width(8.dp))
                Text(text = "${categorySpending.categoryName}: R$ %.2f".format(Math.abs(categorySpending.totalAmount)))
            }
        }
    }
}
