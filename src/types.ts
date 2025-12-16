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
  RENT = 'Aluguel/Condomínio',
  MAINTENANCE = 'Manutenção/Reforma',
  FURNITURE = 'Móveis/Decoração',
  UTILITIES = 'Contas (Luz/Água/Net)',

  FOOD = 'Alimentação',
  RESTAURANTS = 'Restaurantes/Delivery',
  GROCERY = 'Mercado',
  SNACKS = 'Lanches/Café',

  TRANSPORTATION = 'Transporte',
  UBER = 'Uber/Táxi/App',
  FUEL = 'Combustível',
  PUBLIC_TRANSPORT = 'Transporte Público',
  VEHICLE_MAINTENANCE = 'Manutenção Veículo',
  PARKING = 'Estacionamento/Pedágio',

  HEALTH = 'Saúde',
  PHARMACY = 'Farmácia',
  DOCTOR = 'Médico/Dentista',
  EXAMS = 'Exames',
  GYM = 'Academia/Esportes',

  LEISURE = 'Lazer',
  ENTERTAINMENT = 'Cinema/Shows',
  STREAMING = 'Streaming/Assinaturas',
  TRAVEL = 'Viagem',
  HOBBIES = 'Hobbies',

  SHOPPING = 'Compras',
  CLOTHING = 'Roupas/Calçados',
  ELECTRONICS = 'Eletrônicos',
  BEAUTY = 'Beleza/Estética',
  HOME_SHOPPING = 'Artigos para o Lar',

  EDUCATION = 'Educação',
  COURSES = 'Cursos',
  BOOKS = 'Livros/Material',

  PERSONAL = 'Pessoal',
  PERSONAL_CARE = 'Cuidados Pessoais',
  PETS = 'Pets',
  GIFTS = 'Presentes',
  DONATION = 'Doações/Caridade',

  FINANCIAL = 'Financeiro',
  INVESTMENT = 'Investimentos',
  INSURANCE = 'Seguros',
  TAXES = 'Impostos/Taxas',
  FEES = 'Juros/Multas',
  LOANS = 'Empréstimos',

  // INCOME SPECIFIC
  INCOME = 'Salário',
  FREELANCE = 'Freelance/Extra',
  BUSINESS = 'Empresa/Pró-labore',
  DIVIDENDS = 'Dividendos/Rendimentos',
  REFUND = 'Reembolso/Devolução',
  GIFT_RECEIVED = 'Presente Recebido',
  SALES = 'Vendas',

  OTHER = 'Outros',
  TRANSFER = 'Transferência',
  OPENING_BALANCE = 'Saldo Inicial / Ajuste'
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
  categoryId: Category | string;
  amount: number;
  period: 'MONTHLY' | 'YEARLY';
  alertThreshold: number;
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
  initialBalance: number; // Deprecated in favor of transactions, kept for migration
  balance: number;
  currency: string;
  limit?: number;
  closingDay?: number;
  dueDay?: number;
  isInternational?: boolean;
}

export interface FamilyMember extends BaseEntity {
  id: string;
  name: string;
  role?: string;
  email?: string;
  linkedUserId?: string;
}

export interface TransactionSplit {
  memberId: string;
  percentage: number;
  assignedAmount: number;
  relatedMemberId?: string;
  isSettled?: boolean;
  settledAt?: string;
}

export interface Transaction extends BaseEntity {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  category: Category | string;
  description: string;
  accountId?: string;
  destinationAccountId?: string;
  tripId?: string;
  currency?: string;

  isRecurring?: boolean;
  frequency?: Frequency;
  recurrenceDay?: number;
  lastGenerated?: string;

  isInstallment?: boolean;
  currentInstallment?: number;
  totalInstallments?: number;
  originalAmount?: number; // Total value of the purchase before splitting installments
  observation?: string;

  seriesId?: string;

  enableNotification?: boolean;
  notificationDate?: string;

  isShared?: boolean;
  sharedWith?: TransactionSplit[];
  payerId?: string;
  relatedMemberId?: string;

  isRefund?: boolean;

  isSettled?: boolean;
  settledAt?: string;
  settledByTxId?: string;

  destinationAmount?: number;
  exchangeRate?: number;

  reconciled?: boolean;
  reconciledWith?: string;
  externalId?: string;
  sourceTransactionId?: string;
  domain?: 'PERSONAL' | 'TRAVEL' | 'SHARED' | 'BUSINESS'; // Phase 6: Domain Separation
}

export interface AuditLog extends BaseEntity {
  id: string;
  entity: 'TRANSACTION' | 'ACCOUNT' | 'GOAL' | 'BUDGET' | 'TRIP' | 'FAMILY';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changes: string; // JSON string of changes
  userId?: string;
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
  userId: string; // Added for ownership checks
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
  sourceTripId?: string;
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
  ticker: string;
  name: string;
  type: AssetType;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
  accountId: string;
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
  profit?: number;
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

export interface InvoiceItem {
  id: string;
  originalTxId: string;
  description: string;
  date: string;
  category: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  isPaid: boolean;
  tripId?: string;
  memberId: string;
  currency?: string;
  seriesId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface SettlementRequest extends BaseEntity {
  id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  date: string;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  type: 'PAYMENT' | 'CHARGE';
  note?: string;
  responded_at?: string;
}