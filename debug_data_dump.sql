-- DATA DUMP SCRIPT (JSON RETURN)
CREATE OR REPLACE FUNCTION debug_dump_transactions()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'accounts', (SELECT jsonb_agg(to_jsonb(a)) FROM accounts a),
        'transactions', (SELECT jsonb_agg(to_jsonb(t)) FROM transactions t WHERE t.deleted = false)
    ) INTO result;
    return result;
END;
$$ LANGUAGE plpgsql;

SELECT debug_dump_transactions();
