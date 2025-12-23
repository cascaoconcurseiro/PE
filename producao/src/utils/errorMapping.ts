/**
 * Translates raw database/API error messages into user-friendly Portuguese text.
 * Handles specific integrity constraint codes defined in migrations.
 */
export const translateErrorMessage = (errorMessage: string): string => {
    if (!errorMessage) return 'Ocorreu um erro desconhecido.';

    const lowerMsg = errorMessage.toLowerCase();

    // 1. SHARED LIFECYCLE ERRORS (20260112_shared_lifecycle_safety.sql)
    if (lowerMsg.includes('shared_integrity_error: cannot_delete_trip_with_partners_history')) {
        return 'Não é possível excluir esta viagem pois existem despesas lançadas por outros participantes. Solicite que eles removam as despesas primeiro ou arquive a viagem.';
    }
    if (lowerMsg.includes('shared_integrity_error: cannot_delete_member_with_active_shares')) {
        return 'Não é possível remover este membro pois ele possui despesas compartilhadas em aberto. Resolva as pendências financeiras antes de remover.';
    }

    // 2. ACCOUNT SAFETY ERRORS (20260110_account_safety.sql)
    if (lowerMsg.includes('integrity_error: cannot_change_currency_with_transactions')) {
        return 'Não é possível alterar a moeda desta conta pois ela já possui transações registradas. Isso corromperia o histórico financeiro.';
    }
    if (lowerMsg.includes('violates foreign key constraint') && lowerMsg.includes('fk_transactions_account')) {
        return 'Não é possível excluir esta conta permanentemente pois ela possui transações vinculadas. Tente arquivar ou "Desativar" a conta nas configurações.';
    }

    // 3. DEEP INTEGRITY ERRORS (20260109_deep_integrity_constraints.sql)
    if (lowerMsg.includes('chk_shared_validity')) {
        return 'Transações compartilhadas devem ter participantes definidos.';
    }
    if (lowerMsg.includes('chk_split_sum_match')) {
        return 'A soma das divisões não bate com o valor total da transação. Verifique os valores.';
    }
    if (lowerMsg.includes('chk_recurring_validity')) {
        return 'Transações recorrentes precisam ter uma frequência definida.';
    }

    // 4. GENERIC / FALLBACK
    if (lowerMsg.includes('violates foreign key constraint')) {
        return 'Não é possível realizar esta ação pois este item está vinculado a outros registros no sistema.';
    }
    if (lowerMsg.includes('violates unique constraint')) {
        return 'Já existe um registro com estes dados no sistema (Duplicidade).';
    }

    return errorMessage; // Return original if no translation found
};
