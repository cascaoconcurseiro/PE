UPDATE transactions 
    SET description = description 
    WHERE is_shared = true 
      AND mirror_transaction_id IS NULL; -- Apenas as ORIGINAIS (Source)
