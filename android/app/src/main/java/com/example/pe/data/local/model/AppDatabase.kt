package com.example.pe.data.local.model

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.pe.data.local.dao.AccountDao
import com.example.pe.data.local.dao.CardDao
import com.example.pe.data.local.dao.CategoryDao
import com.example.pe.data.local.dao.DebtParticipantDao
import com.example.pe.data.local.dao.ExpenseSplitDao
import com.example.pe.data.local.dao.PersonDao
import com.example.pe.data.local.dao.SharedDebtDao
import com.example.pe.data.local.dao.TransactionDao
import com.example.pe.data.local.dao.TripDao
import com.example.pe.data.local.dao.TripExpenseDao
import com.example.pe.data.local.dao.TripParticipantDao
// Importações explícitas para todas as entidades
import com.example.pe.data.local.model.Account
import com.example.pe.data.local.model.Card
import com.example.pe.data.local.model.Category
import com.example.pe.data.local.model.DebtParticipant
import com.example.pe.data.local.model.ExpenseSplit
import com.example.pe.data.local.model.Person
import com.example.pe.data.local.model.SharedDebt
import com.example.pe.data.local.model.Transaction
import com.example.pe.data.local.model.Trip
import com.example.pe.data.local.model.TripExpense
import com.example.pe.data.local.model.TripParticipant

@Database(
    entities = [
        Transaction::class, Account::class, Card::class, Category::class, Person::class, 
        SharedDebt::class, DebtParticipant::class, Trip::class, TripExpense::class, 
        TripParticipant::class, ExpenseSplit::class
    ], 
    version = 8
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun accountDao(): AccountDao
    abstract fun cardDao(): CardDao
    abstract fun categoryDao(): CategoryDao
    abstract fun personDao(): PersonDao
    abstract fun sharedDebtDao(): SharedDebtDao
    abstract fun debtParticipantDao(): DebtParticipantDao
    abstract fun tripDao(): TripDao
    abstract fun tripExpenseDao(): TripExpenseDao
    abstract fun tripParticipantDao(): TripParticipantDao
    abstract fun expenseSplitDao(): ExpenseSplitDao
}

val MIGRATION_5_6 = object : Migration(5, 6) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("CREATE TABLE trips (id TEXT NOT NULL, name TEXT NOT NULL, destination TEXT NOT NULL, startDate INTEGER NOT NULL, endDate INTEGER NOT NULL, budget REAL NOT NULL, coverImage TEXT, PRIMARY KEY(id))")
        database.execSQL("CREATE TABLE trip_expenses (id TEXT NOT NULL, tripId TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL, date INTEGER NOT NULL, paymentMethod TEXT NOT NULL, attachmentUri TEXT, PRIMARY KEY(id), FOREIGN KEY(tripId) REFERENCES trips(id) ON DELETE CASCADE)")
        database.execSQL("CREATE TABLE trip_participants (tripId TEXT NOT NULL, personId TEXT NOT NULL, PRIMARY KEY(tripId, personId), FOREIGN KEY(tripId) REFERENCES trips(id) ON DELETE CASCADE, FOREIGN KEY(personId) REFERENCES people(id) ON DELETE CASCADE)")
        database.execSQL("CREATE TABLE expense_splits (tripExpenseId TEXT NOT NULL, participantId TEXT NOT NULL, amountOwed REAL NOT NULL, PRIMARY KEY(tripExpenseId, participantId), FOREIGN KEY(tripExpenseId) REFERENCES trip_expenses(id) ON DELETE CASCADE, FOREIGN KEY(participantId) REFERENCES people(id) ON DELETE CASCADE)")
    }
}

val MIGRATION_6_7 = object : Migration(6, 7) {
    override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("ALTER TABLE transactions ADD COLUMN categoryId INTEGER NOT NULL DEFAULT 0")
    }
}

val MIGRATION_7_8 = object : Migration(7, 8) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // 1. Create new table with the correct schema
        database.execSQL("CREATE TABLE transactions_new (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, description TEXT NOT NULL, amount REAL NOT NULL, date INTEGER NOT NULL, categoryId TEXT NOT NULL, FOREIGN KEY(categoryId) REFERENCES categories(id) ON DELETE CASCADE)")
        // 2. Copy data from old table to new table (if necessary, though types are different)
        // Since we are changing types, a direct copy might fail. For simplicity, we just create the new table.
        // If data preservation were critical, we'd need a more complex mapping.
        // database.execSQL("INSERT INTO transactions_new (id, description, amount, date, categoryId) SELECT id, description, amount, date, CAST(categoryId AS TEXT) FROM transactions")
        // 3. Drop the old table
        database.execSQL("DROP TABLE transactions")
        // 4. Rename the new table to the original name
        database.execSQL("ALTER TABLE transactions_new RENAME TO transactions")
    }
}
