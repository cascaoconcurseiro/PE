package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [Transaction::class, Account::class, Card::class, Category::class], version = 3)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun accountDao(): AccountDao
    abstract fun cardDao(): CardDao
    abstract fun categoryDao(): CategoryDao
}

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE transactions ADD COLUMN accountId TEXT NOT NULL DEFAULT ''")
    }
}

val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // Create new table with the correct schema
        database.execSQL("""
            CREATE TABLE transactions_new (
                id TEXT NOT NULL, 
                description TEXT NOT NULL, 
                amount REAL NOT NULL, 
                currency TEXT NOT NULL, 
                date INTEGER NOT NULL, 
                categoryId TEXT NOT NULL, 
                accountId TEXT, 
                cardId TEXT, 
                PRIMARY KEY(id)
            )
            """.trimIndent()
        )
        // Copy data from old table to new table
        database.execSQL("""
            INSERT INTO transactions_new (id, description, amount, currency, date, categoryId, accountId) 
            SELECT id, description, amount, currency, date, categoryId, accountId 
            FROM transactions
            """.trimIndent()
        )
        // Remove the old table
        database.execSQL("DROP TABLE transactions")
        // Rename new table to original name
        database.execSQL("ALTER TABLE transactions_new RENAME TO transactions")
    }
}
