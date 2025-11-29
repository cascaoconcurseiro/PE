export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  ERROR = 'ERROR'
}

export interface BaseEntity {
  createdAt?: string;
  updatedAt?: string;
  deleted?: boolean;
  syncStatus?: SyncStatus;
}

export enum TransactionType {
  INCOME = 'RECEITA',
  EXPENSE = 'DESPESA',
  TRANSFER = 'TRANSFERÊNCIA'
}

export enum AccountType {
  CHECKING = 'CONTA CORRENTE',
  SAVINGS = 'POUPANÇA',
  CREDIT_CARD = 'CARTÃO DE CRÉDITO',
  CASH = 'DINHEIRO',
  INVESTMENT = 'INVESTIMENTOS'
}

export enum Category {
  HOUSING = 'Moradia',
  FOOD = 'Alimentação',
  TRANSPORTATION = 'Transporte',
  UTILITIES = 'Contas e Utilidades',
  TRAVEL = 'Viagem',
  SHOPPING = 'Compras',
  ENTERTAINMENT = 'Lazer',
  HEALTH = 'Saúde',
  EDUCATION = 'Educação',
  PERSONAL_CARE = 'Cuidados Pessoais',
  PETS = 'Pets',
  GIFTS = 'Presentes e Doações',
  INVESTMENT = 'Investimentos',
  INSURANCE = 'Seguros',
  TAXES = 'Impostos e Taxas',
  INCOME = 'Salário/Renda',
  OTHER = 'Outros',
  TRANSFER = 'Transferência'
}

export interface CustomCategory extends BaseEntity {
  id: string;
  name: string;
}

export enum Frequency {
  ONE_TIME = 'Única',
  DAILY = 'Diária',
  WEEKLY = 'Semanal',
  MONTHLY = 'Mensal',
  YEARLY = 'Anual'
}

export interface UserProfile extends BaseEntity {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Budget extends BaseEntity {
  id: string;
  categoryId: Category | string; // Can be a standard Category enum or custom category ID
  amount: number;
  period: 'MONTHLY' | 'YEARLY';
  alertThreshold: number; // Percentage (e.g., 80 for 80%)
  rollover?: boolean;
}

export interface Goal extends BaseEntity {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  icon?: string;
  color?: string;
}

export interface Account extends BaseEntity {
  id: string;
  name: string;
  type: AccountType;
  initialBalance: number;
  balance: number;
  currency: string;
  limit?: number;
  closingDay?: number;
  dueDay?: number;
}

export interface FamilyMember extends BaseEntity {
  id: string;
  name: string;
  role?: string;
  email?: string;
}

export interface TransactionSplit {
  memberId: string;
  percentage: number;
  assignedAmount: number;
  relatedMemberId?: string;
}

export interface Transaction extends BaseEntity {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: Category | string;
  description: string;
  accountId: string;
  destinationAccountId?: string;
  tripId?: string;

  isRecurring?: boolean;
  frequency?: Frequency;
  recurrenceDay?: number;
  lastGenerated?: string;

  isInstallment?: boolean;
  currentInstallment?: number;
  totalInstallments?: number;
  observation?: string;

  // Installment/Recurring Logic
  seriesId?: string; // Links installments of the same purchase

  enableNotification?: boolean;
  notificationDate?: string;

  isShared?: boolean;
  sharedWith?: TransactionSplit[];
  payerId?: string; // ID of the family member who paid (undefined means the user)
  relatedMemberId?: string;

  isRefund?: boolean;

  // Multi-currency Support
  destinationAmount?: number; // For transfers with currency conversion
  exchangeRate?: number;

  // OFX Reconciliation
  reconciled?: boolean;
  reconciledWith?: string; // FITID from OFX
}

export enum View {
  DASHBOARD = 'Dashboard',
  TRANSACTIONS = 'Transações',
  ACCOUNTS = 'Contas',
  BUDGETS = 'Orçamentos',
  GOALS = 'Metas',
  TRIPS = 'Viagens',
  SHARED = 'Compartilhado',
  FAMILY = 'Família',
  SETTINGS = 'Configurações',
  INVESTMENTS = 'Investimentos',
  AI_ADVISOR = 'IA Advisor'
}

export interface TripParticipant {
  id: string;
  name: string;
}

export interface TripItineraryItem {
  id: string;
  date: string;
  time?: string;
  description: string;
  location?: string;
  type: 'FLIGHT' | 'LODGING' | 'ACTIVITY' | 'FOOD' | 'OTHER';
}

export interface TripChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface TripShoppingItem {
  id: string;
  item: string;
  estimatedCost?: number;
  purchased: boolean;
  actualCost?: number;
}

export interface TripExchangeEntry {
  id: string;
  date: string;
  amountBRL: number;
  exchangeRate: number;
  amountForeign: number;
  currency: string;
}

export interface Trip extends BaseEntity {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  participants: TripParticipant[];
  currency: string;
  budget: number;
  imageUrl?: string;
  itinerary?: TripItineraryItem[];
  checklist?: TripChecklistItem[];
  shoppingList?: TripShoppingItem[];
  exchangeEntries?: TripExchangeEntry[];
}

export enum AssetType {
  STOCK = 'Ação',
  FII = 'FII',
  CRYPTO = 'Criptomoeda',
  FIXED_INCOME = 'Renda Fixa',
  ETF = 'ETF',
  REIT = 'REIT',
  TREASURY = 'Tesouro Direto',
  OTHER = 'Outro'
}

export interface Asset extends BaseEntity {
  id: string;
  ticker: string; // e.g., PETR4, BTC, HGLG11
  name: string;
  type: AssetType;
  quantity: number;
  averagePrice: number; // Preço Médio
  currentPrice: number; // Cotação Atual
  currency: string;
  accountId: string; // Which account holds this asset (e.g., Binance, XP)
  lastUpdate?: string;
  tradeHistory?: TradeHistory[];
}

export interface TradeHistory {
  id: string;
  date: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  profit?: number; // Only for SELL
  currency: string;
}

export interface Snapshot extends BaseEntity {
  id: string;
  date: string;
  totalBalance: number;
  totalInvested: number;
  totalDebt: number;
  netWorth: number;
}
