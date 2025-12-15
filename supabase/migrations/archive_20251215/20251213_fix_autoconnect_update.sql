-- FIX: AUTO-CONNECT ON UPDATE
-- DESCRIÇÃO: Habilita a trigger de auto-conexão também na atualização de email
-- DATA: 13/12/2025

DROP TRIGGER IF EXISTS trig_auto_connect_members ON family_members;

CREATE TRIGGER trig_auto_connect_members
AFTER INSERT OR UPDATE OF email ON family_members
FOR EACH ROW
EXECUTE FUNCTION handle_auto_connection_lifecycle();
