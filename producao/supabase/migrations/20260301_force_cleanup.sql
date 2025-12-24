-- FORCE DELETE SCRIPT
-- RUN THIS TO CLEAN THE MESS

-- 1. Desabilita RLS temporariamente para garantir que deleta TUDO
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries DISABLE ROW LEVEL SECURITY;

-- 2. Deleta as transações duplicadas
-- Critério: Descrição contendo 1/10.. 10/10 E criadas hoje
DELETE FROM public.transactions 
WHERE description ~ '\(\d+/\d+\)'  -- Regex para (X/Y)
  AND created_at > (NOW() - INTERVAL '1 day');

-- 3. Deleta orfãos do Ledger
DELETE FROM public.ledger_entries
WHERE transaction_id NOT IN (SELECT id FROM public.transactions);

-- 4. Reabilita RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
