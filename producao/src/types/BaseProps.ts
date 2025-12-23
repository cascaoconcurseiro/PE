/**
 * Interfaces Props consolidadas para reduzir duplicação
 * Consolida ~50 interfaces Props repetitivas em abstrações genéricas
 * Validates: Requirements 3.1
 */

import { ReactNode } from 'react';

// ============================================================================
// BASE ENTITY PROPS - Padrões comuns para entidades
// ============================================================================

/**
 * Props base para qualquer entidade do sistema
 */
export interface BaseEntityProps<T = any> {
    data?: T | T[];
    loading?: boolean;
    error?: string | null;
    userId?: string;
    className?: string;
    children?: ReactNode;
}

/**
 * Props base para operações CRUD
 */
export interface BaseCRUDProps<T = any> {
    onAdd?: (item: Omit<T, 'id'>) => void;
    onEdit?: (item: T) => void;
    onUpdate?: (item: T) => void;
    onDelete?: (id: string) => void;
    onSave?: (item: T | Omit<T, 'id'>) => void;
}

/**
 * Props base para modais e formulários
 */
export interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCancel?: () => void;
    title?: string;
    children?: ReactNode;
}

/**
 * Props base para formulários
 */
export interface BaseFormProps<T = any> extends BaseModalProps {
    initialData?: T | null;
    onSave: (data: T | Omit<T, 'id'>) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    isReadOnly?: boolean;
    errors?: Record<string, string>;
}

/**
 * Props base para navegação
 */
export interface BaseNavigationProps {
    onBack?: () => void;
    onNext?: () => void;
    onNavigateToAccounts?: () => void;
    onNavigateToTrips?: () => void;
    onNavigateToFamily?: () => void;
    onNavigateToShared?: () => void;
}

// ============================================================================
// DOMAIN-SPECIFIC PROPS - Props específicas por domínio
// ============================================================================

/**
 * Props base para componentes de transação
 */
export interface BaseTransactionProps extends BaseEntityProps {
    transactions?: import('../types').Transaction[];
    accounts?: import('../types').Account[];
    onAddTransaction?: (t: Omit<import('../types').Transaction, 'id'>) => void;
    onUpdateTransaction?: (t: import('../types').Transaction) => void;
    onDeleteTransaction?: (id: string) => void;
    onEditTransaction?: (id: string) => void;
}

/**
 * Props base para componentes de viagem
 */
export interface BaseTripProps extends BaseEntityProps {
    trips?: import('../types').Trip[];
    onAddTrip?: (t: import('../types').Trip) => void;
    onUpdateTrip?: (t: import('../types').Trip) => void;
    onDeleteTrip?: (id: string) => void;
    onEditTrip?: (trip: import('../types').Trip) => void;
}

/**
 * Props base para componentes de conta
 */
export interface BaseAccountProps extends BaseEntityProps {
    accounts?: import('../types').Account[];
    onAddAccount?: (a: Omit<import('../types').Account, 'id'>) => void;
    onUpdateAccount?: (a: import('../types').Account) => void;
    onDeleteAccount?: (id: string) => void;
    onEditAccount?: (account: import('../types').Account) => void;
}

/**
 * Props base para componentes de família
 */
export interface BaseFamilyProps extends BaseEntityProps {
    familyMembers?: import('../types').FamilyMember[];
    onAddMember?: (m: Omit<import('../types').FamilyMember, 'id'>) => void;
    onUpdateMember?: (m: import('../types').FamilyMember) => void;
    onDeleteMember?: (id: string) => void;
    onEditMember?: (member: import('../types').FamilyMember) => void;
}

// ============================================================================
// UI COMPONENT PROPS - Props para componentes de UI
// ============================================================================

/**
 * Props base para componentes de lista
 */
export interface BaseListProps<T = any> extends BaseEntityProps<T[]> {
    items: T[];
    onItemClick?: (item: T) => void;
    onItemSelect?: (item: T) => void;
    selectedItems?: T[];
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
    emptyMessage?: string;
    renderItem?: (item: T) => ReactNode;
}

/**
 * Props base para componentes de seleção
 */
export interface BaseSelectorProps<T = any> {
    label: string;
    selectedId?: string;
    onSelect: (id: string) => void;
    options: T[];
    disabled?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    renderOption?: (option: T) => ReactNode;
}

/**
 * Props base para componentes de filtro
 */
export interface BaseFilterProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    selectedCategory?: string;
    setSelectedCategory?: (category: string) => void;
    selectedAccount?: string;
    setSelectedAccount?: (account: string) => void;
    dateRange?: { start: string; end: string };
    setDateRange?: (range: { start: string; end: string }) => void;
}

/**
 * Props base para componentes de dashboard/resumo
 */
export interface BaseSummaryProps {
    title?: string;
    data: Record<string, number>;
    loading?: boolean;
    showPrivacy?: boolean;
    currency?: string;
    period?: string;
}

/**
 * Props base para componentes de gráfico
 */
export interface BaseChartProps {
    data: Array<{ name: string; value: number; color?: string }>;
    width?: number;
    height?: number;
    showLegend?: boolean;
    currency?: string;
    loading?: boolean;
}

// ============================================================================
// COMPOSITE PROPS - Combinações comuns
// ============================================================================

/**
 * Props completas para páginas principais
 */
export interface BasePageProps extends 
    BaseTransactionProps, 
    BaseTripProps, 
    BaseAccountProps, 
    BaseFamilyProps, 
    BaseNavigationProps {
    currentUserId?: string;
    currentUserName?: string;
}

/**
 * Props para componentes de detalhes
 */
export interface BaseDetailProps<T = any> extends 
    BaseEntityProps<T>,
    BaseCRUDProps<T>,
    BaseNavigationProps {
    item: T;
    onBack: () => void;
}

/**
 * Props para componentes de formulário completo
 */
export interface BaseCompleteFormProps<T = any> extends 
    BaseFormProps<T>,
    BaseNavigationProps {
    customCategories?: import('../types').CustomCategory[];
}

// ============================================================================
// UTILITY TYPES - Tipos utilitários
// ============================================================================

/**
 * Extrai o tipo de dados de uma interface Props
 */
export type ExtractDataType<T> = T extends BaseEntityProps<infer U> ? U : never;

/**
 * Torna todas as props opcionais exceto as especificadas
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Props com handlers opcionais
 */
export type WithOptionalHandlers<T> = T & {
    [K in keyof T as K extends `on${string}` ? K : never]?: T[K];
};