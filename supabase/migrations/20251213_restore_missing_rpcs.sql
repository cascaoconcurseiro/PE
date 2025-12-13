-- RESTORE: Missing Core RPCs
-- These functions are essential for Dashboard, Reports, and Transaction management.
-- They seem to have been lost in previous migrations or resets.

-- 1. Get Account Totals (Optimized Server-Side Calculation)
CREATE OR REPLACE FUNCTION public.get_account_totals(p_user_id UUID)
RETURNS TABLE (account_id UUID, calculated_balance NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        COALESCE(SUM(t.amount), 0) + COALESCE(a.initial_balance, 0) as calculated_balance
    FROM 
        accounts a
    LEFT JOIN 
        transactions t ON t.account_id = a.id AND t.deleted = false
    WHERE 
        a.user_id = p_user_id AND a.deleted = false
    GROUP BY 
        a.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Get Monthly Cashflow (For Dashboard Charts)
CREATE OR REPLACE FUNCTION public.get_monthly_cashflow(p_year INT, p_user_id UUID)
RETURNS TABLE (month INT, income NUMERIC, expense NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(MONTH FROM date)::INT as month,
        SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'DESPESA' THEN amount ELSE 0 END) as expense
    FROM 
        transactions
    WHERE 
        user_id = p_user_id
        AND deleted = false
        AND EXTRACT(YEAR FROM date)::INT = p_year
        AND type IN ('RECEITA', 'DESPESA')
        -- Exclude Opening Balance from Cashflow Reports (It's not income/expense flow)
        AND category != 'Saldo Inicial / Ajuste'
    GROUP BY 
        EXTRACT(MONTH FROM date)
    ORDER BY 
        month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Recreate Transaction Series (Atomic Update for Recurring Edits)
CREATE OR REPLACE FUNCTION public.recreate_transaction_series(p_old_series_id UUID, p_new_transactions JSONB)
RETURNS VOID AS $$
DECLARE
    tx_data JSONB;
BEGIN
    -- 1. Soft Delete Old Series
    UPDATE transactions 
    SET deleted = true, updated_at = NOW()
    WHERE series_id = p_old_series_id;

    -- 2. Insert New Transactions
    -- Assuming p_new_transactions is an array of transaction objects
    FOR tx_data IN SELECT * FROM jsonb_array_elements(p_new_transactions)
    LOOP
        INSERT INTO transactions (
            user_id, account_id, amount, date, description, category, 
            type, is_recurring, series_id, frequency, recurrence_day, total_installments, current_installment
        ) VALUES (
            (tx_data->>'user_id')::UUID,
            (tx_data->>'account_id')::UUID,
            (tx_data->>'amount')::NUMERIC,
            (tx_data->>'date')::DATE,
            tx_data->>'description',
            tx_data->>'category',
            tx_data->>'type',
            (tx_data->>'is_recurring')::BOOLEAN,
            (tx_data->>'series_id')::UUID,
            tx_data->>'frequency',
            (tx_data->>'recurrence_day')::INT,
            (tx_data->>'total_installments')::INT,
            (tx_data->>'current_installment')::INT
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
