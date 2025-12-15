-- FIX TRIP CURRENCY MIRRORING & SYNC
-- Objective: Ensure Mirror Trips inherit the Currency from the Source Trip.
-- This fixes the issue where Shared Transactions linked to a Mirror Trip were hidden from Dashboard
-- because the Mirror Trip had incorrect/missing currency (interpreted as Foreign).

-- 1. UPDATE TRIGGER TO COPY CURRENCY
CREATE OR REPLACE FUNCTION public.handle_mirror_shared_transaction()
RETURNS TRIGGER AS $func$
DECLARE
    split JSONB;
    target_member_id UUID;
    target_user_id UUID;
    target_trip_id UUID; 
    inviter_name TEXT;
    original_trip_rec RECORD;
BEGIN
    IF (TG_OP = 'INSERT') AND (auth.uid() = NEW.user_id) AND (NEW.is_shared = true) AND (NEW.shared_with IS NOT NULL) AND (jsonb_array_length(NEW.shared_with) > 0) THEN
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = auth.uid();
        FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM public.family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                -- TRIP LOGIC
                target_trip_id := NULL;
                IF NEW.trip_id IS NOT NULL THEN
                    -- 1. Try to find existing mirror (SAFE CAST)
                    SELECT id INTO target_trip_id FROM trips 
                    WHERE source_trip_id::text = NEW.trip_id::text AND user_id = target_user_id;

                    -- 2. If not found, CREATE IT AUTOMATICALLY
                    IF target_trip_id IS NULL THEN
                        SELECT * INTO original_trip_rec FROM trips WHERE id::text = NEW.trip_id::text;
                        IF original_trip_rec.id IS NOT NULL THEN
                            INSERT INTO trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, 
                                currency, -- ✅ COPY CURRENCY
                                created_at, updated_at
                            ) VALUES (
                                target_user_id, 
                                original_trip_rec.name, 
                                original_trip_rec.start_date, 
                                original_trip_rec.end_date, 
                                original_trip_rec.budget,
                                original_trip_rec.image_url, 
                                original_trip_rec.id, -- source_trip_id
                                original_trip_rec.participants, 
                                original_trip_rec.currency, -- ✅ COPY CURRENCY
                                NOW(), 
                                NOW()
                            ) RETURNING id INTO target_trip_id;
                        END IF;
                    END IF;
                END IF;

                -- INSERT TRANSACTION
                INSERT INTO public.transactions (
                    user_id, amount, date, description, category, type, is_shared, payer_id, shared_with, trip_id, created_at, updated_at
                ) VALUES (
                    target_user_id, 
                    (split->>'assignedAmount')::NUMERIC, 
                    NEW.date, 
                    NEW.description || ' (Compartilhado por ' || COALESCE(inviter_name, 'Alguém') || ')',
                    NEW.category, 
                    'DESPESA', 
                    true, 
                    auth.uid()::text,
                    '[]'::jsonb, 
                    target_trip_id,
                    NOW(), 
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RETROACTIVE FIX: SYNC CURRENCY FOR EXISTING MIRRORS
-- Update any trip that has a source_trip_id to match the source's currency.
UPDATE trips t_target
SET currency = t_source.currency
FROM trips t_source
WHERE t_target.source_trip_id = t_source.id
  AND t_target.currency IS DISTINCT FROM t_source.currency;

