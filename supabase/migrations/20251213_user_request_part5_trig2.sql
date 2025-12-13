DROP TRIGGER IF EXISTS trig_mirror_transactions_full ON transactions;
CREATE TRIGGER trig_mirror_transactions_full
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW
EXECUTE FUNCTION handle_transaction_mirroring_v4();
