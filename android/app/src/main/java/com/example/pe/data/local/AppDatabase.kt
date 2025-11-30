package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.example.pe.data.local.dao.TransactionDao
import com.example.pe.data.local.model.Transaction

@Database(entities = [Transaction::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
}
