-- 20260115_fix_audit_entity_error.sql
-- PROBLEM: 'audit_logs' has a NOT NULL 'entity' column, but the generic trigger fails to populate it.
-- SOLUTION: Update 'fn_audit_log_changes' to map 'TG_TABLE_NAME' to the required 'entity' Enum/Text.

-- 1. Ensure the column exists and is nullable temporarily to fix existing rows if any? 
-- Actually, we can just fix the function.

CREATE OR REPLACE FUNCTION public.fn_audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entity text;
BEGIN
    -- Map Table Name to Entity
    CASE TG_TABLE_NAME
        WHEN 'transactions' THEN v_entity := 'TRANSACTION';
        WHEN 'accounts' THEN v_entity := 'ACCOUNT';
        WHEN 'trips' THEN v_entity := 'TRIP';
        WHEN 'goals' THEN v_entity := 'GOAL';
        WHEN 'budgets' THEN v_entity := 'BUDGET';
        WHEN 'family_members' THEN v_entity := 'FAMILY';
        ELSE v_entity := UPPER(TG_TABLE_NAME); -- Fallback
    END CASE;

    -- Insert with 'entity' populated
    INSERT INTO public.audit_logs (
        entity, -- The missing column causing the error
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_by,
        changed_at
    )
    VALUES (
        v_entity,
        TG_TABLE_NAME::text,
        COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
            gen_random_uuid()
        ),
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(
            auth.uid(),
            (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
            '00000000-0000-0000-0000-000000000000'::uuid
        ),
        NOW()
    );

    RETURN NULL;
END;
$$;
