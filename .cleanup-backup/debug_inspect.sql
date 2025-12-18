-- INSPECTION SCRIPT
-- Lists triggers and column types to diagnose 'uuid = text' error.

DO $$
DECLARE
    r RECORD;
BEGIN
    RAISE NOTICE '--- TRIGGERS ON transactions ---';
    FOR r IN SELECT trigger_name, event_manipulation, action_statement 
             FROM information_schema.triggers 
             WHERE event_object_table = 'transactions'
    LOOP
        RAISE NOTICE '% | %', r.trigger_name, r.event_manipulation;
    END LOOP;

    RAISE NOTICE '--- COLUMNS ON transactions ---';
    FOR r IN SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'transactions' AND column_name IN ('user_id', 'trip_id', 'payer_id', 'account_id')
    LOOP
        RAISE NOTICE '%: %', r.column_name, r.data_type;
    END LOOP;

    RAISE NOTICE '--- COLUMNS ON trips ---';
    FOR r IN SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'trips' AND column_name IN ('id', 'user_id', 'source_trip_id')
    LOOP
        RAISE NOTICE '%: %', r.column_name, r.data_type;
    END LOOP;
END $$;
