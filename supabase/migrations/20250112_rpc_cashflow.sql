-- FUNCTION: get_monthly_cashflow
-- Returns aggregated income and expense for each month of a given year.
-- Optimized for Dashboard Charts to avoid fetching thousands of rows.

CREATE OR REPLACE FUNCTION get_monthly_cashflow(
    p_year INT,
    p_user_id UUID
)
RETURNS TABLE (
    month INT,
    income NUMERIC,
    expense NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH monthly_data AS (
        SELECT
            EXTRACT(MONTH FROM t.date)::INT as month_num,
            t.type,
            CASE 
                -- Refund: Negative Expense
                WHEN t.type = 'EXPENSE' AND t.is_refund THEN -t.amount
                
                -- Expense: Subtract splits to get effective cost
                WHEN t.type = 'EXPENSE' THEN
                    t.amount - (
                        SELECT COALESCE(SUM((x->>'assignedAmount')::numeric), 0)
                        FROM jsonb_array_elements(COALESCE(t.shared_with, '[]'::jsonb)) x
                    )
                
                -- Income
                ELSE t.amount
            END as effective_amount
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE t.user_id = p_user_id
          AND t.deleted = false
          AND EXTRACT(YEAR FROM t.date) = p_year
          AND t.type IN ('INCOME', 'EXPENSE')
          -- Liquidity Only (Cash Flow View) - Exclude Credit Cards and Investments
          AND a.type IN ('checking', 'savings', 'cash', 'CHECKING', 'SAVINGS', 'CASH') 
    )
    SELECT
        m.month_num,
        COALESCE(SUM(CASE WHEN m.type = 'INCOME' THEN m.effective_amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN m.type = 'EXPENSE' THEN m.effective_amount ELSE 0 END), 0) as expense
    FROM monthly_data m
    GROUP BY m.month_num
    ORDER BY m.month_num;
END;
$$;
