package com.example.pe.ui.features.family

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.pe.data.local.Person
import com.example.pe.data.local.PersonDao
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class AddPersonViewModel @Inject constructor(
    private val personDao: PersonDao
) : ViewModel() {

    fun savePerson(name: String) {
        viewModelScope.launch {
            val newPerson = Person(
                id = UUID.randomUUID().toString(),
                name = name
            )
            personDao.insert(newPerson)
        }
    }
}
