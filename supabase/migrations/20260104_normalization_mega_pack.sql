-- ==============================================================================
-- MIGRATION: RIGOROUS NORMALIZATION (2026-01-04)
-- DESCRIPTION: Extracts Arrays from JSONB into proper Relational Tables.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. TRIP PARTICIPANTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trip_participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    member_id UUID, -- Keep traceability to family_members id
    user_id UUID REFERENCES auth.users(id), -- Resolved Real User
    role TEXT DEFAULT 'MEMBER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.trip_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_trip_participants" ON public.trip_participants FOR ALL USING (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
);

-- Backfill
INSERT INTO public.trip_participants (trip_id, member_id, user_id)
SELECT 
    t.id,
    (p->>'memberId')::UUID,
    fm.linked_user_id
FROM public.trips t
CROSS JOIN LATERAL jsonb_array_elements(t.participants) as p
LEFT JOIN public.family_members fm ON fm.id = (p->>'memberId')::UUID
WHERE t.participants IS NOT NULL AND jsonb_array_length(t.participants) > 0;

-- ==============================================================================
-- 2. TRIP CHECKLIST
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trip_checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    label TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    category TEXT DEFAULT 'GERAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.trip_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_trip_checklist" ON public.trip_checklist_items FOR ALL USING (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
);

-- Backfill
INSERT INTO public.trip_checklist_items (trip_id, label, is_checked, category)
SELECT 
    t.id,
    p->>'label',
    COALESCE((p->>'checked')::BOOLEAN, false),
    COALESCE(p->>'category', 'GERAL')
FROM public.trips t
CROSS JOIN LATERAL jsonb_array_elements(t.checklist) as p
WHERE t.checklist IS NOT NULL AND jsonb_array_length(t.checklist) > 0;


-- ==============================================================================
-- 3. TRIP SHOPPING LIST
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trip_shopping_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    is_checked BOOLEAN DEFAULT FALSE,
    assigned_to UUID, -- Could link to participant?
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.trip_shopping_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_trip_shopping" ON public.trip_shopping_items FOR ALL USING (
    EXISTS (SELECT 1 FROM trips t WHERE t.id = trip_id AND t.user_id = auth.uid())
);

-- Backfill
INSERT INTO public.trip_shopping_items (trip_id, name, is_checked)
SELECT 
    t.id,
    p->>'item',
    COALESCE((p->>'checked')::BOOLEAN, false)
FROM public.trips t
CROSS JOIN LATERAL jsonb_array_elements(t.shopping_list) as p
WHERE t.shopping_list IS NOT NULL AND jsonb_array_length(t.shopping_list) > 0;


-- ==============================================================================
-- 4. ASSET TRADES (Crucial for Tax)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.asset_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL,
    type TEXT NOT NULL, -- 'BUY', 'SELL'
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    total_amount NUMERIC,
    fees NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.asset_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view_asset_trades" ON public.asset_trades FOR ALL USING (
    EXISTS (SELECT 1 FROM assets a WHERE a.id = asset_id AND a.user_id = auth.uid())
);

-- Backfill
INSERT INTO public.asset_trades (asset_id, date, type, quantity, price, total_amount)
SELECT 
    a.id,
    (t->>'date')::TIMESTAMP,
    t->>'type',
    (t->>'quantity')::NUMERIC,
    (t->>'price')::NUMERIC,
    (t->>'total')::NUMERIC
FROM public.assets a
CROSS JOIN LATERAL jsonb_array_elements(a.trade_history) as t
WHERE a.trade_history IS NOT NULL AND jsonb_array_length(a.trade_history) > 0;


-- ==============================================================================
-- 5. TRIGGER: SYNC ALL JSON -> TABLES (The "Bridge")
-- ==============================================================================

CREATE OR REPLACE FUNCTION sync_trips_json_to_tables()
RETURNS TRIGGER AS $$
DECLARE
    item JSONB;
    resolved_user_id UUID;
BEGIN
    -- Only update if relevant JSONs changed
    
    -- 1. Sync Participants
    IF (TG_OP = 'INSERT') OR (NEW.participants IS DISTINCT FROM OLD.participants) THEN
        DELETE FROM public.trip_participants WHERE trip_id = NEW.id;
        IF NEW.participants IS NOT NULL THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.participants) LOOP
                -- Resolve User
                SELECT linked_user_id INTO resolved_user_id FROM public.family_members WHERE id = (item->>'memberId')::UUID;
                INSERT INTO public.trip_participants (trip_id, member_id, user_id)
                VALUES (NEW.id, (item->>'memberId')::UUID, resolved_user_id);
            END LOOP;
        END IF;
    END IF;

    -- 2. Sync Checklist
    IF (TG_OP = 'INSERT') OR (NEW.checklist IS DISTINCT FROM OLD.checklist) THEN
        DELETE FROM public.trip_checklist_items WHERE trip_id = NEW.id;
        IF NEW.checklist IS NOT NULL THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.checklist) LOOP
                INSERT INTO public.trip_checklist_items (trip_id, label, is_checked, category)
                VALUES (NEW.id, item->>'label', COALESCE((item->>'checked')::BOOLEAN, false), COALESCE(item->>'category', 'GERAL'));
            END LOOP;
        END IF;
    END IF;

    -- 3. Sync Shopping
    IF (TG_OP = 'INSERT') OR (NEW.shopping_list IS DISTINCT FROM OLD.shopping_list) THEN
        DELETE FROM public.trip_shopping_items WHERE trip_id = NEW.id;
        IF NEW.shopping_list IS NOT NULL THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.shopping_list) LOOP
                INSERT INTO public.trip_shopping_items (trip_id, name, is_checked)
                VALUES (NEW.id, item->>'item', COALESCE((item->>'checked')::BOOLEAN, false));
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_trips_normalization ON public.trips;
CREATE TRIGGER trg_sync_trips_normalization 
    AFTER INSERT OR UPDATE ON public.trips 
    FOR EACH ROW EXECUTE FUNCTION sync_trips_json_to_tables();

-- ASSETS SYNC
CREATE OR REPLACE FUNCTION sync_assets_json_to_tables()
RETURNS TRIGGER AS $$
DECLARE item JSONB;
BEGIN
    IF (TG_OP = 'INSERT') OR (NEW.trade_history IS DISTINCT FROM OLD.trade_history) THEN
        DELETE FROM public.asset_trades WHERE asset_id = NEW.id;
        IF NEW.trade_history IS NOT NULL THEN
            FOR item IN SELECT * FROM jsonb_array_elements(NEW.trade_history) LOOP
                INSERT INTO public.asset_trades (asset_id, date, type, quantity, price, total_amount)
                VALUES (NEW.id, (item->>'date')::TIMESTAMP, item->>'type', (item->>'quantity')::NUMERIC, (item->>'price')::NUMERIC, (item->>'total')::NUMERIC);
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_assets_normalization ON public.assets;
CREATE TRIGGER trg_sync_assets_normalization
    AFTER INSERT OR UPDATE ON public.assets
    FOR EACH ROW EXECUTE FUNCTION sync_assets_json_to_tables();

COMMIT;
