package com.example.pe.di

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.pe.data.local.Account
import com.example.pe.data.local.AccountDao
import com.example.pe.data.local.AppDatabase
import com.example.pe.data.local.CardDao
import com.example.pe.data.local.Category
import com.example.pe.data.local.CategoryDao
import com.example.pe.data.local.DebtParticipantDao
import com.example.pe.data.local.MIGRATION_1_2
import com.example.pe.data.local.MIGRATION_2_3
import com.example.pe.data.local.MIGRATION_3_4
import com.example.pe.data.local.MIGRATION_4_5
import com.example.pe.data.local.MIGRATION_5_6
import com.example.pe.data.local.Person
import com.example.pe.data.local.PersonDao
import com.example.pe.data.local.SharedDebtDao
import com.example.pe.data.local.TransactionDao
import com.example.pe.data.local.dao.ExpenseSplitDao
import com.example.pe.data.local.dao.TripDao
import com.example.pe.data.local.dao.TripExpenseDao
import com.example.pe.data.local.dao.TripParticipantDao
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
        @ApplicationContext context: Context,
        categoryDaoProvider: Provider<CategoryDao>,
        accountDaoProvider: Provider<AccountDao>,
        personDaoProvider: Provider<PersonDao>
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "finance-app.db"
        )
        .addCallback(object : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                CoroutineScope(Dispatchers.IO).launch {
                    categoryDaoProvider.get().insertAll(defaultCategories)
                    accountDaoProvider.get().insert(defaultAccount)
                    personDaoProvider.get().insert(defaultUser)
                }
            }
        })
        .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6)
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

private val defaultCategories = listOf(
    Category(id = UUID.randomUUID().toString(), name = "Alimentação", icon = "", color = "#FF5733"),
    Category(id = UUID.randomUUID().toString(), name = "Transporte", icon = "", color = "#33AFFF"),
    Category(id = UUID.randomUUID().toString(), name = "Moradia", icon = "", color = "#FFC300"),
    Category(id = UUID.randomUUID().toString(), name = "Lazer", icon = "", color = "#C70039"),
    Category(id = UUID.randomUUID().toString(), name = "Saúde", icon = "", color = "#900C3F"),
    Category(id = UUID.randomUUID().toString(), name = "Educação", icon = "", color = "#581845"),
    Category(id = UUID.randomUUID().toString(), name = "Salário", icon = "", color = "#33FF57")
)

private val defaultAccount = Account(id = UUID.randomUUID().toString(), name = "Carteira", initialBalance = 0.0)
private val defaultUser = Person(id = UUID.randomUUID().toString(), name = "Você")
