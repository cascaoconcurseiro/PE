package com.example.pe.di

import android.content.Context
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.pe.data.local.AppDatabase
import com.example.pe.data.local.Category
import com.example.pe.data.local.TransactionDao
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
        // Using Provider to avoid cyclic dependency
        categoryDaoProvider: Provider<com.example.pe.data.local.CategoryDao>
    ): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "finance-app.db"
        )
        .addCallback(object : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                // Pre-populate database
                CoroutineScope(Dispatchers.IO).launch {
                    categoryDaoProvider.get().insertAll(defaultCategories)
                }
            }
        })
        .build()
    }

    @Provides
    fun provideTransactionDao(appDatabase: AppDatabase): TransactionDao {
        return appDatabase.transactionDao()
    }

    @Provides
    fun provideCategoryDao(appDatabase: AppDatabase): com.example.pe.data.local.CategoryDao {
        return appDatabase.categoryDao()
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
