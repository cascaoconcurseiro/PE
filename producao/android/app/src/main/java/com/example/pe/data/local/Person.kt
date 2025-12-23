package com.example.pe.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "people")
data class Person(
    @PrimaryKey val id: String,
    val name: String
)
