package com.example.pe.di

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.pe.data.local.AppDatabase
import com.example.pe.data.local.MIGRATION_1_2
import com.example.pe.data.local.MIGRATION_2_3
import com.example.pe.data.local.MIGRATION_3_4
import com.example.pe.data.local.MIGRATION_4_5
import com.example.pe.data.local.MIGRATION_5_6
import com.example.pe.data.local.MIGRATION_6_7
import com.example.pe.data.local.MIGRATION_7_8
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
import com.example.pe.data.local.model.Account
import com.example.pe.data.local.model.Category
import com.example.pe.data.local.model.Person
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Provider
import javax.inject.Singleton

@InstallIn(SingletonComponent::class)
@Module
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "finance-app.db"
        )
        .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6, MIGRATION_6_7, MIGRATION_7_8)
        .fallbackToDestructiveMigration() // Adicionado como uma salvaguarda
        .build()
    }

    @Provides
    fun provideTransactionDao(appDatabase: AppDatabase): TransactionDao {
        return appDatabase.transactionDao()
    }

    @Provides
    fun provideCategoryDao(appDatabase: AppDatabase): CategoryDao {
        return appDatabase.categoryDao()
    }

    @Provides
    fun provideAccountDao(appDatabase: AppDatabase): AccountDao {
        return appDatabase.accountDao()
    }

    @Provides
    fun provideCardDao(appDatabase: AppDatabase): CardDao {
        return appDatabase.cardDao()
    }

    @Provides
    fun providePersonDao(appDatabase: AppDatabase): PersonDao {
        return appDatabase.personDao()
    }

    @Provides
    fun provideSharedDebtDao(appDatabase: AppDatabase): SharedDebtDao {
        return appDatabase.sharedDebtDao()
    }

    @Provides
    fun provideDebtParticipantDao(appDatabase: AppDatabase): DebtParticipantDao {
        return appDatabase.debtParticipantDao()
    }

    @Provides
    fun provideTripDao(appDatabase: AppDatabase): TripDao {
        return appDatabase.tripDao()
    }

    @Provides
    fun provideTripExpenseDao(appDatabase: AppDatabase): TripExpenseDao {
        return appDatabase.tripExpenseDao()
    }

    @Provides
    fun provideTripParticipantDao(appDatabase: AppDatabase): TripParticipantDao {
        return appDatabase.tripParticipantDao()
    }

    @Provides
    fun provideExpenseSplitDao(appDatabase: AppDatabase): ExpenseSplitDao {
        return appDatabase.expenseSplitDao()
    }
}
