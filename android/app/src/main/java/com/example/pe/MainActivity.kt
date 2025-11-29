package com.example.pe

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.example.pe.ui.features.main.MainScreen
import com.example.pe.ui.theme.PETheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            PETheme {
                MainScreen()
            }
        }
    }
}
