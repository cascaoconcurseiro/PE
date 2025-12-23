package com.example.pe.data.repository

import com.example.pe.data.local.Person
import com.example.pe.data.local.PersonDao
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class PersonRepository @Inject constructor(
    private val personDao: PersonDao
) {
    fun getAllPeople(): Flow<List<Person>> = personDao.getAll()

    suspend fun insert(person: Person) {
        personDao.insert(person)
    }
}
