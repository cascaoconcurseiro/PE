package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(entities = [Transaction::class, Account::class, Card::class, Category::class], version = 1)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun accountDao(): AccountDao
    abstract fun cardDao(): CardDao
    abstract fun categoryDao(): CategoryDao
}
