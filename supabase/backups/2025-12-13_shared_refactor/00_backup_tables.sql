-- BACKUP DE SEGURANÇA
-- Data: 2025-12-13
-- Objetivo: Criar snapshot das tabelas críticas antes da migração do Motor Compartilhado

CREATE TABLE IF NOT EXISTS transactions_backup_20251213 AS
SELECT * FROM transactions;

CREATE TABLE IF NOT EXISTS family_members_backup_20251213 AS
SELECT * FROM family_members;

-- Para verificar se funcionou:
-- SELECT COUNT(*) FROM transactions_backup_20251213;
