-- Verificar tipo da coluna payer_id
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
  AND column_name = 'payer_id';

-- Verificar alguns valores de payer_id
SELECT DISTINCT payer_id, pg_typeof(payer_id) as tipo
FROM public.transactions
WHERE payer_id IS NOT NULL
LIMIT 10;
