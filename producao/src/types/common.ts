/**
 * Tipos Comuns e Utilitários
 * 
 * Tipos compartilhados para substituir `any` em todo o sistema
 */

// Tipos genéricos para operações CRUD
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

// Tipos para callbacks
export type Callback<T = void> = (data: T) => void | Promise<void>;
export type AsyncCallback<T = void> = (data: T) => Promise<void>;

// Tipos para formulários
export type FormData<T> = Partial<T> & { id?: string };
export type FormErrors<T> = Partial<Record<keyof T, string>>;

// Tipos para modais
export interface ModalProps<T = unknown> {
  isOpen: boolean;
  onClose: () => void;
  data?: T;
  onSave?: (data: T) => void | Promise<void>;
}

// Tipos para notificações
export interface NotificationData {
  id?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// Tipos para requests/responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  success: boolean;
}

// Tipos para filtros
export interface FilterOptions {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  type?: string;
  [key: string]: unknown;
}

// Tipos para paginação
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Tipos para eventos
export type EventHandler<T = unknown> = (event: T) => void;
export type AsyncEventHandler<T = unknown> = (event: T) => Promise<void>;

// Tipos para configurações
export interface AppConfig {
  version: string;
  environment: 'development' | 'production' | 'test';
  features: Record<string, boolean>;
}

// Tipos para erros estruturados
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
  timestamp: string;
}

// Tipos para dados de importação/exportação
export interface ImportData {
  accounts?: unknown[];
  transactions?: unknown[];
  trips?: unknown[];
  budgets?: unknown[];
  goals?: unknown[];
  familyMembers?: unknown[];
  assets?: unknown[];
  snapshots?: unknown[];
  customCategories?: unknown[];
}

export interface ExportData extends ImportData {
  exportedAt: string;
  version: string;
}

// Tipos para operações em lote
export interface BulkOperation<T> {
  items: T[];
  success: boolean;
  errors?: Array<{ item: T; error: string }>;
}

// Tipos para validação
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Tipos para componentes genéricos
export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

// Tipos para hooks
export interface UseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Tipos para contextos
export interface ContextValue<T> {
  value: T;
  update: (newValue: Partial<T>) => void;
  reset: () => void;
}

