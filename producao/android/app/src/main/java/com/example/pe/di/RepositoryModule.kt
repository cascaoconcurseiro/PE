package com.example.pe.di

import com.example.pe.data.local.PersonDao
import com.example.pe.data.local.dao.DebtParticipantDao
import com.example.pe.data.local.dao.SharedDebtDao
import com.example.pe.data.local.dao.TripParticipantDao
import com.example.pe.data.repository.PersonRepository
import com.example.pe.data.repository.SharedDebtRepository
import com.example.pe.data.repository.TripParticipantRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideSharedDebtRepository(
        sharedDebtDao: SharedDebtDao,
        debtParticipantDao: DebtParticipantDao
    ): SharedDebtRepository {
        return SharedDebtRepository(sharedDebtDao, debtParticipantDao)
    }

    @Provides
    @Singleton
    fun providePersonRepository(personDao: PersonDao): PersonRepository {
        return PersonRepository(personDao)
    }

    @Provides
    @Singleton
    fun provideTripParticipantRepository(tripParticipantDao: TripParticipantDao): TripParticipantRepository {
        return TripParticipantRepository(tripParticipantDao)
    }
}
