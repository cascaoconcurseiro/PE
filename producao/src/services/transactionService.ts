import { supabase } from '@/integrations/supabase/client';

export const deleteTransaction = async (transactionId: string) => {
  // Delete the transaction; cascade will remove related ledger entries
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId);

  if (error) throw error;
  return true;
};