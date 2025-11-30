package com.example.pe.ui

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class MainAppViewModel @Inject constructor(
    val snackbarManager: SnackbarManager
) : ViewModel()
