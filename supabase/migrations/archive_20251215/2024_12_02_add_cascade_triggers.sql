-- Trigger to update updated_at on accounts
CREATE OR REPLACE FUNCTION public.update_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();

-- Trigger to update updated_at on transactions
CREATE OR REPLACE FUNCTION public.update_transactions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_transactions_updated_at();

-- Trigger to update updated_at on ledger_entries
CREATE OR REPLACE FUNCTION public.update_ledger_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_ledger_entries_updated_at
BEFORE UPDATE ON public.ledger_entries
FOR EACH ROW EXECUTE FUNCTION public.update_ledger_entries_updated_at();