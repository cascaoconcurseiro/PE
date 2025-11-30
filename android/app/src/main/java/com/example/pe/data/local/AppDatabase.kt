package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.example.pe.data.local.dao.ParticipantDao
import com.example.pe.data.local.dao.TransactionDao
import com.example.pe.data.local.dao.TripDao
import com.example.pe.data.local.dao.TripExpenseDao
import com.example.pe.data.local.model.Participant
import com.example.pe.data.local.model.Transaction
import com.example.pe.data.local.model.Trip
import com.example.pe.data.local.model.TripExpense

@Database(entities = [Transaction::class, Trip::class, Participant::class, TripExpense::class], version = 4, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun tripDao(): TripDao
    abstract fun participantDao(): ParticipantDao
    abstract fun tripExpenseDao(): TripExpenseDao
}
