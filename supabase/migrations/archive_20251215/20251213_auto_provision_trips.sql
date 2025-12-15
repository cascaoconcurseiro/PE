-- MIGRATION: Auto-Provision Trips for Shared Participants
-- This fixes the issue where User B doesn't see the trip, causing expenses to be orphaned.

-- 1. Ensure columns exist for tracking source (Idempotency)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'source_trip_id') THEN
        ALTER TABLE trips ADD COLUMN source_trip_id UUID;
    END IF;
END $$;

-- 2. Create the Provisioning Logic
CREATE OR REPLACE FUNCTION handle_trip_sharing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    participant_record JSONB;
    target_member_id UUID;
    target_user_id UUID;
    source_user_id UUID;
    existing_mirror_id UUID;
BEGIN
    -- GUARD: Only if participants exist
    IF NEW.participants IS NULL OR jsonb_array_length(NEW.participants) = 0 THEN
        RETURN NEW;
    END IF;

    -- GUARD: Infinite Loop Prevention (If this is a mirror trip itself)
    IF NEW.source_trip_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    source_user_id := NEW.user_id;

    -- ITERATE PARTICIPANTS
    FOR participant_record IN SELECT * FROM jsonb_array_elements(NEW.participants)
    LOOP
        target_member_id := (participant_record->>'memberId')::UUID;
        
        -- Resolve User ID from Member ID
        SELECT linked_user_id INTO target_user_id
        FROM family_members
        WHERE id = target_member_id;

        -- Only proceed if it's a real connected user
        IF target_user_id IS NOT NULL THEN
            
            -- Check if mirror already exists for this user
            SELECT id INTO existing_mirror_id
            FROM trips
            WHERE user_id = target_user_id 
              AND (source_trip_id = NEW.id OR (name = NEW.name AND start_date = NEW.start_date)); -- Smart Match Fallback

            IF existing_mirror_id IS NOT NULL THEN
                -- UPDATE Existing Mirror
                UPDATE trips
                SET 
                    name = NEW.name,
                    start_date = NEW.start_date,
                    end_date = NEW.end_date,
                    image_url = NEW.image_url,
                    updated_at = NOW()
                WHERE id = existing_mirror_id;
            ELSE
                -- INSERT New Mirror
                INSERT INTO trips (
                    user_id,
                    name,
                    start_date,
                    end_date,
                    budget,
                    image_url,
                    source_trip_id, -- Link back to original
                    participants, -- Copy participants? Maybe, for context.
                    created_at,
                    updated_at
                ) VALUES (
                    target_user_id,
                    NEW.name,
                    NEW.start_date,
                    NEW.end_date,
                    0, -- Start with 0 budget/tracking for receiver? Or copy? Let's 0 to avoid confusion.
                    NEW.image_url,
                    NEW.id,
                    NEW.participants,
                    NOW(),
                    NOW()
                );
            END IF;

        END IF;

    END LOOP;

    RETURN NEW;
END;
$$;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS on_trip_change ON trips;
CREATE TRIGGER on_trip_change
    AFTER INSERT OR UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION handle_trip_sharing();
