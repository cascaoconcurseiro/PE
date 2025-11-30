package com.example.pe.data.local.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey

@Entity(
    tableName = "participants",
    foreignKeys = [
        ForeignKey(
            entity = Trip::class,
            parentColumns = ["id"],
            childColumns = ["tripId"],
            onDelete = ForeignKey.CASCADE // Se uma viagem for excluída, seus participantes também serão.
        )
    ]
)
data class Participant(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val tripId: Int,
    val name: String,
    val email: String
)
