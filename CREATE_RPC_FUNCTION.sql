-- =============================================
-- FUNÇÃO RPC PARA CALCULAR SALDOS DAS CONTAS
-- =============================================
-- Execute este script no Supabase Dashboard > SQL Editor
-- Isso melhora a performance do carregamento inicial

CREATE OR REPLACE FUNCTION get_account_totals(p_user_id UUID)
RETURNS TABLE (account_id UUID, calculated_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id AS account_id,
        (
            COALESCE(a.initial_balance, 0) + 
            COALESCE((
                SELECT SUM(
                    CASE 
                        WHEN t.type = 'RECEITA' THEN t.amount
                        WHEN t.type = 'DESPESA' THEN -t.amount
                        WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = a.id THEN -t.amount
                        WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = a.id THEN COALESCE(t.destination_amount, t.amount)
                        ELSE 0
                    END
                )
                FROM transactions t
                WHERE 
                    (t.account_id = a.id OR t.destination_account_id = a.id)
                    AND t.user_id = p_user_id
                    AND t.deleted = FALSE
                    AND t.date <= CURRENT_DATE
            ), 0)
        )::NUMERIC AS calculated_balance
    FROM accounts a
    WHERE a.user_id = p_user_id AND a.deleted = FALSE;
END;
$$;

-- Conceder permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION get_account_totals(UUID) TO authenticated;
