package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [Transaction::class, Account::class, Card::class, Category::class, Person::class, SharedDebt::class, DebtParticipant::class], version = 5)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun accountDao(): AccountDao
    abstract fun cardDao(): CardDao
    abstract fun categoryDao(): CategoryDao
    abstract fun personDao(): PersonDao
    abstract fun sharedDebtDao(): SharedDebtDao
    abstract fun debtParticipantDao(): DebtParticipantDao
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

val MIGRATION_3_4 = object : Migration(3, 4) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("CREATE TABLE people (id TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(id))")
    }
}

val MIGRATION_4_5 = object : Migration(4, 5) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("CREATE TABLE shared_debts (id TEXT NOT NULL, transactionId TEXT NOT NULL, paidByPersonId TEXT NOT NULL, splitType TEXT NOT NULL, PRIMARY KEY(id))")
        database.execSQL("CREATE TABLE debt_participants (sharedDebtId TEXT NOT NULL, personId TEXT NOT NULL, amountOwed REAL NOT NULL, hasPaid INTEGER NOT NULL, PRIMARY KEY(sharedDebtId, personId))")
    }
}
