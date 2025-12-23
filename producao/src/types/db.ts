
import { SyncStatus, TransactionType, Frequency, AccountType, AssetType } from '../types';

export interface DBBaseEntity {
    id: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    deleted: boolean;
    sync_status: SyncStatus;
}

export interface DBTransaction extends DBBaseEntity {
    date: string;
    amount: number;
    type: TransactionType;
    category: string;
    description: string;
    account_id?: string;
    destination_account_id?: string;
    trip_id?: string;
    currency?: string;

    is_recurring?: boolean;
    frequency?: Frequency;
    recurrence_day?: number;
    last_generated?: string;

    is_installment?: boolean;
    current_installment?: number;
    total_installments?: number;
    original_amount?: number;
    series_id?: string;

    enable_notification?: boolean;
    notification_date?: string;

    observation?: string;
    is_shared?: boolean;
    shared_with?: Record<string, unknown>[] | null; // JSONB
    payer_id?: string;

    is_settled?: boolean;
    settled_at?: string;

    is_refund?: boolean;
    destination_amount?: number;
    exchange_rate?: number;

    external_id?: string;
}

export interface DBAccount extends DBBaseEntity {
    name: string;
    type: AccountType;
    initial_balance: number;
    balance: number;
    currency: string;
    credit_limit?: number;
    closing_day?: number;
    due_day?: number;
    is_international?: boolean;
}

export interface DBTrip extends DBBaseEntity {
    name: string;
    start_date: string;
    end_date: string;
    budget: number;
    image_url?: string;
    currency: string;
    participants: Record<string, unknown>[] | null; // JSONB
    itinerary?: Record<string, unknown>[] | null; // JSONB
    checklist?: Record<string, unknown>[] | null; // JSONB
    shopping_list?: Record<string, unknown>[] | null; // JSONB
    exchange_entries?: Record<string, unknown>[] | null; // JSONB
    source_trip_id?: string;
}

export interface DBBudget extends DBBaseEntity {
    category_id: string; // Stored as category name or ID
    amount: number;
    period: 'MONTHLY' | 'YEARLY';
    alert_threshold: number;
    rollover?: boolean;
}

export interface DBGoal extends DBBaseEntity {
    name: string;
    target_amount: number;
    current_amount: number;
    deadline?: string;
    icon?: string;
    color?: string;
}

export interface DBAsset extends DBBaseEntity {
    ticker: string;
    name: string;
    type: AssetType;
    quantity: number;
    average_price: number;
    current_price: number;
    currency: string;
    account_id: string;
    last_update?: string;
    trade_history?: Record<string, unknown>[] | null; // JSONB
}

export interface DBSnapshot extends DBBaseEntity {
    date: string;
    total_balance: number;
    total_invested: number;
    total_debt: number;
    net_worth: number;
}

export interface DBCustomCategory extends DBBaseEntity {
    name: string;
}

export interface DBFamilyMember extends DBBaseEntity {
    name: string;
    role?: string;
    email?: string;
}
