package com.example.pe.domain.mapper

import com.example.pe.data.local.model.Transaction as DataTransaction
import com.example.pe.domain.model.Transaction as DomainTransaction

fun DataTransaction.toDomain(): DomainTransaction {
    return DomainTransaction(
        id = this.id,
        description = this.description,
        amount = this.amount,
        date = this.date
    )
}

fun DomainTransaction.toData(): DataTransaction {
    return DataTransaction(
        id = this.id,
        description = this.description,
        amount = this.amount,
        date = this.date
    )
}
