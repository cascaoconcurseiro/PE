package com.example.pe.di

import android.content.Context
import androidx.room.Room
import com.example.pe.data.local.AppDatabase
import com.example.pe.data.local.dao.ParticipantDao
import com.example.pe.data.local.dao.TransactionDao
import com.example.pe.data.local.dao.TripDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "pe-de-meia.db"
        ).fallbackToDestructiveMigration().build()
    }

    @Provides
    fun provideTransactionDao(appDatabase: AppDatabase): TransactionDao {
        return appDatabase.transactionDao()
    }

    @Provides
    fun provideTripDao(appDatabase: AppDatabase): TripDao {
        return appDatabase.tripDao()
    }

    @Provides
    fun provideParticipantDao(appDatabase: AppDatabase): ParticipantDao {
        return appDatabase.participantDao()
    }
}
