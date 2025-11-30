package com.example.pe.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [Transaction::class, Account::class, Card::class, Category::class, Person::class, SharedDebt::class, DebtParticipant::class, Trip::class, TripExpense::class, TripParticipant::class, ExpenseSplit::class], version = 6)
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
