-- Backup Script for System Restructure
-- Execute this script to create a complete backup before starting the restructure

-- Create backup schema
CREATE SCHEMA IF NOT EXISTS backup_pre_restructure;

-- Backup all main tables with data
CREATE TABLE backup_pre_restructure.accounts AS SELECT * FROM accounts;
CREATE TABLE backup_pre_restructure.transactions AS SELECT * FROM transactions;
CREATE TABLE backup_pre_restructure.trips AS SELECT * FROM trips;
CREATE TABLE backup_pre_restructure.family_members AS SELECT * FROM family_members;
CREATE TABLE backup_pre_restructure.assets AS SELECT * FROM assets;

-- Backup user settings if exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_settings') THEN
        EXECUTE 'CREATE TABLE backup_pre_restructure.user_settings AS SELECT * FROM user_settings';
    END IF;
END $$;

-- Create metadata table
CREATE TABLE backup_pre_restructure.backup_metadata (
    created_at TIMESTAMPTZ DEFAULT NOW(),
    total_accounts INTEGER,
    total_transactions INTEGER,
    total_trips INTEGER,
    total_family_members INTEGER,
    notes TEXT
);

-- Insert backup metadata
INSERT INTO backup_pre_restructure.backup_metadata (
    total_accounts,
    total_transactions,
    total_trips,
    total_family_members,
    notes
) VALUES (
    (SELECT COUNT(*) FROM accounts),
    (SELECT COUNT(*) FROM transactions),
    (SELECT COUNT(*) FROM trips),
    (SELECT COUNT(*) FROM family_members),
    'Backup created before system restructure - ' || NOW()::TEXT
);

-- Backup current functions and triggers (as text)
CREATE TABLE backup_pre_restructure.functions_backup (
    function_name TEXT,
    function_definition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store current trigger definitions
CREATE TABLE backup_pre_restructure.triggers_backup (
    trigger_name TEXT,
    table_name TEXT,
    trigger_definition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log successful backup
DO $$
BEGIN
    RAISE NOTICE 'Backup completed successfully at %', NOW();
    RAISE NOTICE 'Backup schema: backup_pre_restructure';
    RAISE NOTICE 'Tables backed up: accounts, transactions, trips, family_members, assets';
END $$;