import { db } from './db';
import {
    Account, AccountType, Transaction, TransactionType, Category,
    Asset, AssetType, Budget, Goal, Trip, FamilyMember, UserProfile,
    Frequency, SyncStatus
} from '../types';

export const seedDatabase = async () => {
    // Check if database is already populated
    const txCount = await db.transactions.count();
    if (txCount > 0) return;

    console.log('Seeding database...');

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. User Profile
    const user: UserProfile = {
        id: crypto.randomUUID(),
        name: 'Usuário Demo',
        email: 'demo@pedemeia.app',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING
    };
    await db.userProfile.add(user);

    // 2. Family Members
    const member1Id = crypto.randomUUID();
    const member2Id = crypto.randomUUID();
    const members: FamilyMember[] = [
        {
            id: member1Id,
            name: 'Ana (Esposa)',
            role: 'Parceira',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: member2Id,
            name: 'Pedro (Filho)',
            role: 'Filho',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        }
    ];
    await db.familyMembers.bulkAdd(members);

    // 3. Accounts
    const accCheckingId = crypto.randomUUID();
    const accSavingsId = crypto.randomUUID();
    const accInvestId = crypto.randomUUID();
    const accWalletId = crypto.randomUUID();
    const accCardId = crypto.randomUUID();

    const accounts: Account[] = [
        {
            id: accCheckingId,
            name: 'Conta Principal (Nubank)',
            type: AccountType.CHECKING,
            initialBalance: 5000,
            balance: 5000,
            currency: 'BRL',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: accSavingsId,
            name: 'Reserva de Emergência',
            type: AccountType.SAVINGS,
            initialBalance: 15000,
            balance: 15000,
            currency: 'BRL',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: accInvestId,
            name: 'XP Investimentos',
            type: AccountType.INVESTMENT,
            initialBalance: 50000,
            balance: 50000,
            currency: 'BRL',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: accWalletId,
            name: 'Carteira Física',
            type: AccountType.CASH,
            initialBalance: 250,
            balance: 250,
            currency: 'BRL',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: accCardId,
            name: 'Nubank Ultravioleta',
            type: AccountType.CREDIT_CARD,
            initialBalance: 0,
            balance: 0,
            currency: 'BRL',
            limit: 20000,
            closingDay: 1,
            dueDay: 10,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        }
    ];
    await db.accounts.bulkAdd(accounts);

    // 4. Transactions (Generate some history)
    const transactions: Transaction[] = [];

    // Salary
    transactions.push({
        id: crypto.randomUUID(),
        date: new Date(currentYear, currentMonth, 5).toISOString().split('T')[0],
        amount: 8500,
        type: TransactionType.INCOME,
        category: Category.INCOME,
        description: 'Salário Mensal',
        accountId: accCheckingId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING
    });

    // Rent
    transactions.push({
        id: crypto.randomUUID(),
        date: new Date(currentYear, currentMonth, 10).toISOString().split('T')[0],
        amount: 2500,
        type: TransactionType.EXPENSE,
        category: Category.HOUSING,
        description: 'Aluguel + Condomínio',
        accountId: accCheckingId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING
    });

    // Supermarket (Card)
    transactions.push({
        id: crypto.randomUUID(),
        date: new Date(currentYear, currentMonth, 15).toISOString().split('T')[0],
        amount: 850.45,
        type: TransactionType.EXPENSE,
        category: Category.FOOD,
        description: 'Compras do Mês',
        accountId: accCardId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING
    });

    // Investment Transfer
    transactions.push({
        id: crypto.randomUUID(),
        date: new Date(currentYear, currentMonth, 6).toISOString().split('T')[0],
        amount: 2000,
        type: TransactionType.TRANSFER,
        category: Category.INVESTMENT,
        description: 'Aporte Mensal',
        accountId: accCheckingId,
        destinationAccountId: accInvestId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING
    });

    // Dinner (Cash)
    transactions.push({
        id: crypto.randomUUID(),
        date: new Date(currentYear, currentMonth, 20).toISOString().split('T')[0],
        amount: 120,
        type: TransactionType.EXPENSE,
        category: Category.ENTERTAINMENT,
        description: 'Jantar Fora',
        accountId: accWalletId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING
    });

    await db.transactions.bulkAdd(transactions);

    // 5. Assets
    const assets: Asset[] = [
        {
            id: crypto.randomUUID(),
            ticker: 'PETR4',
            name: 'Petrobras PN',
            type: AssetType.STOCK,
            quantity: 100,
            averagePrice: 32.50,
            currentPrice: 35.80,
            currency: 'BRL',
            accountId: accInvestId,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: crypto.randomUUID(),
            ticker: 'HGLG11',
            name: 'CSHG Logística',
            type: AssetType.FII,
            quantity: 50,
            averagePrice: 160.00,
            currentPrice: 165.50,
            currency: 'BRL',
            accountId: accInvestId,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: crypto.randomUUID(),
            ticker: 'BTC',
            name: 'Bitcoin',
            type: AssetType.CRYPTO,
            quantity: 0.05,
            averagePrice: 250000,
            currentPrice: 350000,
            currency: 'BRL',
            accountId: accInvestId,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        }
    ];
    await db.assets.bulkAdd(assets);

    // 6. Budgets
    const budgets: Budget[] = [
        {
            id: crypto.randomUUID(),
            categoryId: Category.FOOD,
            amount: 1500,
            period: 'MONTHLY',
            alertThreshold: 80,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: crypto.randomUUID(),
            categoryId: Category.ENTERTAINMENT,
            amount: 500,
            period: 'MONTHLY',
            alertThreshold: 90,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        }
    ];
    await db.budgets.bulkAdd(budgets);

    // 7. Goals
    const goals: Goal[] = [
        {
            id: crypto.randomUUID(),
            name: 'Viagem Europa',
            targetAmount: 30000,
            currentAmount: 5000,
            deadline: new Date(currentYear + 1, 6, 1).toISOString(),
            color: '#10b981', // emerald-500
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        },
        {
            id: crypto.randomUUID(),
            name: 'Trocar de Carro',
            targetAmount: 80000,
            currentAmount: 25000,
            deadline: new Date(currentYear + 2, 0, 1).toISOString(),
            color: '#3b82f6', // blue-500
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            syncStatus: SyncStatus.PENDING
        }
    ];
    await db.goals.bulkAdd(goals);

    // 8. Trips
    const trip: Trip = {
        id: crypto.randomUUID(),
        name: 'Férias em Gramado',
        startDate: new Date(currentYear, currentMonth + 2, 10).toISOString(),
        endDate: new Date(currentYear, currentMonth + 2, 20).toISOString(),
        participants: [
            { id: user.id, name: user.name },
            { id: member1Id, name: 'Ana' }
        ],
        currency: 'BRL',
        budget: 8000,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        syncStatus: SyncStatus.PENDING,
        itinerary: [
            {
                id: crypto.randomUUID(),
                date: new Date(currentYear, currentMonth + 2, 10).toISOString(),
                description: 'Chegada em Porto Alegre e Aluguel de Carro',
                type: 'FLIGHT'
            },
            {
                id: crypto.randomUUID(),
                date: new Date(currentYear, currentMonth + 2, 11).toISOString(),
                description: 'Passeio no Lago Negro',
                type: 'ACTIVITY'
            }
        ],
        checklist: [
            { id: crypto.randomUUID(), text: 'Reservar Hotel', isCompleted: true },
            { id: crypto.randomUUID(), text: 'Comprar Passagens', isCompleted: true },
            { id: crypto.randomUUID(), text: 'Alugar Carro', isCompleted: false },
            { id: crypto.randomUUID(), text: 'Fazer Malas', isCompleted: false }
        ]
    };
    await db.trips.add(trip);

    console.log('Database seeded successfully!');
};
