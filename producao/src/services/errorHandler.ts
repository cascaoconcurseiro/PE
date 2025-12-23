/**
 * Sistema de Tratamento de Erros Financeiros
 * 
 * Centraliza tratamento de erros do sistema financeiro
 * Fornece mensagens amigáveis ao usuário
 * Permite recuperação automática quando possível
 */

export class FinancialError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
    public rollback?: () => Promise<void>,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FinancialError';
    Object.setPrototypeOf(this, FinancialError.prototype);
  }
}

interface DatabaseError {
  code?: string;
  message?: string;
  constraint?: string;
}

/**
 * Mapeia erros do Supabase para erros financeiros amigáveis
 */
export const handleDatabaseError = (error: unknown): FinancialError => {
  const dbError = error as DatabaseError;
  
  // Erro de violação de constraint única (duplicata)
  if (dbError.code === '23505') {
    return new FinancialError(
      'Já existe um registro com esses dados. Verifique se não está duplicando uma transação.',
      'DUPLICATE',
      true
    );
  }
  
  // Erro de violação de chave estrangeira
  if (dbError.code === '23503') {
    return new FinancialError(
      'Referência inválida. A conta ou transação relacionada não existe mais.',
      'INVALID_REFERENCE',
      true
    );
  }
  
  // Erro de violação de constraint de check
  if (dbError.code === '23514') {
    const constraint = dbError.constraint || '';
    
    if (constraint.includes('amount_positive')) {
      return new FinancialError(
        'Valor inválido. O valor deve ser maior que zero.',
        'INVALID_AMOUNT',
        false
      );
    }
    
    if (constraint.includes('transfer_has_destination')) {
      return new FinancialError(
        'Transferência inválida. É necessário especificar uma conta de destino.',
        'INVALID_TRANSFER',
        false
      );
    }
    
    if (constraint.includes('transfer_not_same_account')) {
      return new FinancialError(
        'Transferência inválida. A conta de origem não pode ser a mesma do destino.',
        'CIRCULAR_TRANSFER',
        false
      );
    }
    
    return new FinancialError(
      'Dados inválidos. Verifique os campos preenchidos.',
      'VALIDATION_ERROR',
      false
    );
  }
  
  // Erro de autenticação
  if (dbError.code === 'PGRST301' || dbError.message?.includes('JWT')) {
    return new FinancialError(
      'Sessão expirada. Por favor, faça login novamente.',
      'AUTH_ERROR',
      true
    );
  }
  
  // Erro de permissão
  if (dbError.code === '42501') {
    return new FinancialError(
      'Você não tem permissão para realizar esta operação.',
      'PERMISSION_DENIED',
      false
    );
  }
  
  // Erro genérico do banco
  if (dbError.code?.startsWith('PGRST') || dbError.code?.startsWith('42')) {
    return new FinancialError(
      'Erro ao processar operação no banco de dados. Tente novamente.',
      'DATABASE_ERROR',
      true,
      undefined,
      { originalError: dbError.message }
    );
  }
  
  // Erro desconhecido
  return new FinancialError(
    'Erro inesperado ao processar operação. Tente novamente ou entre em contato com suporte.',
    'UNKNOWN_ERROR',
    false,
    undefined,
    { originalError: dbError.message, code: dbError.code }
  );
};

/**
 * Trata erro financeiro com rollback se necessário
 */
export const handleFinancialError = async (
  error: unknown,
  operation: string = 'Operação'
): Promise<FinancialError> => {
  // Se já é um FinancialError, retornar
  if (error instanceof FinancialError) {
    // Executar rollback se disponível
    if (error.rollback) {
      try {
        await error.rollback();
      } catch (rollbackError) {
        // Erro ao executar rollback - ignorar silenciosamente
      }
    }
    return error;
  }
  
  // Se é erro do Supabase, converter
  if (error && typeof error === 'object' && 'code' in error) {
    return handleDatabaseError(error);
  }
  
  // Erro genérico
  return new FinancialError(
    `Erro ao ${operation.toLowerCase()}. Tente novamente.`,
    'UNKNOWN_ERROR',
    false,
    undefined,
    { originalError: String(error) }
  );
};

/**
 * Mensagens amigáveis para códigos de erro
 */
export const getErrorMessage = (code: string): string => {
  const messages: Record<string, string> = {
    'DUPLICATE': 'Este registro já existe. Verifique se não está duplicando.',
    'INVALID_REFERENCE': 'Referência inválida. Verifique se a conta ou transação ainda existe.',
    'INVALID_AMOUNT': 'Valor inválido. O valor deve ser maior que zero.',
    'INVALID_TRANSFER': 'Transferência inválida. Verifique as contas selecionadas.',
    'CIRCULAR_TRANSFER': 'Transferência circular. A origem não pode ser igual ao destino.',
    'VALIDATION_ERROR': 'Dados inválidos. Verifique os campos preenchidos.',
    'AUTH_ERROR': 'Sessão expirada. Por favor, faça login novamente.',
    'PERMISSION_DENIED': 'Você não tem permissão para realizar esta operação.',
    'DATABASE_ERROR': 'Erro ao processar no banco de dados. Tente novamente.',
    'UNKNOWN_ERROR': 'Erro inesperado. Tente novamente ou entre em contato com suporte.'
  };
  
  return messages[code] || messages['UNKNOWN_ERROR'];
};

