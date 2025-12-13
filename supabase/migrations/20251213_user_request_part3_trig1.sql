DROP TRIGGER IF EXISTS trig_auto_connect_members ON family_members;
CREATE TRIGGER trig_auto_connect_members
AFTER INSERT ON family_members
FOR EACH ROW
EXECUTE FUNCTION handle_auto_connection_lifecycle();
