-- ==============================================================================
-- DIAGNOSTICO: INVESTIGACAO DE DISCREPANCIA (JAN/2026)
-- DATE: 2025-12-15
-- ==============================================================================

DO $$
DECLARE
    rec RECORD;
    mirror_rec RECORD;
BEGIN
    RAISE NOTICE '--- INICIANDO DIAGNOSTICO ---';

    -- 1. Buscar pelos itens Originais (Wesley)
    RAISE NOTICE '1. Buscando itens originais (Carro, Natação)...';
    
    FOR rec IN 
        SELECT id, user_id, description, date, amount, trip_id, shared_with
        FROM transactions 
        WHERE date::TEXT LIKE '2026-01-%' -- Janeiro 2026
          AND (description ILIKE '%Carro - Orlando%' OR description ILIKE '%Natação%')
          AND type = 'DESPESA'
    LOOP
        RAISE NOTICE 'ORIGINAL ENCONTRADO: ID=% | Desc=% | Valor=% | TripID=% | UserID=%', 
            rec.id, rec.description, rec.amount, rec.trip_id, rec.user_id;

        -- 2. Verificar se existe o Espelho (Para quem foi compartilhado)
        RAISE NOTICE '   -> Verificando espelhos para este item...';
        
        -- Fix: Use SELECT * INTO to handle record structure correctly
        SELECT * INTO mirror_rec
        FROM transactions
        WHERE amount = rec.amount
          AND date = rec.date
          AND user_id != rec.user_id
          AND (
                description ILIKE '%Carro - Orlando%' OR 
                description ILIKE '%Natação%' OR
                description ILIKE '%' || split_part(rec.description, ' (', 1) || '%'
              )
        LIMIT 1;
        
        IF FOUND THEN
             RAISE NOTICE '   ✅ ESPELHO ENCONTRADO: ID=% | UserID=% | TripID=%', mirror_rec.id, mirror_rec.user_id, mirror_rec.trip_id;
             
             IF rec.trip_id IS NULL AND mirror_rec.trip_id IS NOT NULL THEN
                RAISE NOTICE '   ⚠️ ALERTA: Original sem Trip, mas Espelho COM Trip! Isso esconde o item na aba Mensal.';
             END IF;
             
             IF mirror_rec.trip_id IS NOT NULL THEN
                 RAISE NOTICE '   ℹ️ INFO: Este item está na aba VIAGENS (TripID=%).', mirror_rec.trip_id;
             ELSE
                 RAISE NOTICE '   ℹ️ INFO: Este item está na aba MENSAL (Sem Trip).';
             END IF;
        ELSE
             RAISE NOTICE '   ❌ NENHUM ESPELHO ENCONTRADO.';
        END IF;
        
    END LOOP;

    RAISE NOTICE '--- FIM DO DIAGNOSTICO ---';
END $$;
