
import { Category, AssetType } from '../types';

export interface CategoryGroup {
    label: string;
    options: Category[];
}

export interface AssetGroup {
    label: string;
    options: AssetType[];
}

export const INCOME_CATEGORIES: CategoryGroup[] = [
    {
        label: '💰 Entradas',
        options: [
            Category.INCOME,
            Category.FREELANCE,
            Category.BUSINESS,
            Category.SALES
        ]
    },
    {
        label: '📈 Rendimentos',
        options: [
            Category.DIVIDENDS,
            Category.INVESTMENT
        ]
    },
    {
        label: '↩️ Outros',
        options: [
            Category.REFUND,
            Category.GIFT_RECEIVED,
            Category.OTHER
        ]
    }
];

export const EXPENSE_CATEGORIES: CategoryGroup[] = [
    {
        label: '🏠 Moradia',
        options: [
            Category.HOUSING,
            Category.RENT,
            Category.MAINTENANCE,
            Category.FURNITURE,
            Category.UTILITIES
        ]
    },
    {
        label: '🍽️ Alimentação',
        options: [
            Category.FOOD,
            Category.RESTAURANTS,
            Category.GROCERY,
            Category.SNACKS
        ]
    },
    {
        label: '🚗 Transporte',
        options: [
            Category.TRANSPORTATION,
            Category.UBER,
            Category.FUEL,
            Category.PUBLIC_TRANSPORT,
            Category.VEHICLE_MAINTENANCE,
            Category.PARKING
        ]
    },
    {
        label: '🏥 Saúde',
        options: [
            Category.HEALTH,
            Category.PHARMACY,
            Category.DOCTOR,
            Category.EXAMS,
            Category.GYM
        ]
    },
    {
        label: '🎬 Lazer',
        options: [
            Category.LEISURE,
            Category.ENTERTAINMENT,
            Category.STREAMING,
            Category.TRAVEL,
            Category.HOBBIES
        ]
    },
    {
        label: '🛍️ Compras',
        options: [
            Category.SHOPPING,
            Category.CLOTHING,
            Category.ELECTRONICS,
            Category.BEAUTY,
            Category.HOME_SHOPPING
        ]
    },
    {
        label: '🎓 Educação',
        options: [
            Category.EDUCATION,
            Category.COURSES,
            Category.BOOKS
        ]
    },
    {
        label: '👤 Pessoal',
        options: [
            Category.PERSONAL,
            Category.PERSONAL_CARE,
            Category.PETS,
            Category.GIFTS,
            Category.DONATION
        ]
    },
    {
        label: '💰 Financeiro',
        options: [
            Category.FINANCIAL,
            Category.INVESTMENT,
            Category.INSURANCE,
            Category.TAXES,
            Category.FEES,
            Category.LOANS
        ]
    },
    {
        label: '📦 Outros',
        options: [
            Category.OTHER
        ]
    }
];

export const ASSET_CATEGORIES: AssetGroup[] = [
    {
        label: '📈 Renda Variável',
        options: [
            AssetType.STOCK,
            AssetType.FII,
            AssetType.ETF,
            AssetType.REIT,
            AssetType.CRYPTO
        ]
    },
    {
        label: '🛡️ Renda Fixa',
        options: [
            AssetType.FIXED_INCOME,
            AssetType.TREASURY
        ]
    },
    {
        label: '📦 Outros',
        options: [
            AssetType.OTHER
        ]
    }
];
