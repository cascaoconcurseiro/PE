-- Add currency column to settlement_requests
ALTER TABLE public.settlement_requests 
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';

-- Optional: Update existing to BRL (already covered by default)
