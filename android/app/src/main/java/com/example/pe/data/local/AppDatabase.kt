package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.example.pe.data.local.dao.TransactionDao
import com.example.pe.data.local.dao.TripDao
import com.example.pe.data.local.model.Transaction
import com.example.pe.data.local.model.Trip

@Database(entities = [Transaction::class, Trip::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun tripDao(): TripDao
}
