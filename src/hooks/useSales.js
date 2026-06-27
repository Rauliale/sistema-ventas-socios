import { useState } from 'react';
import { db } from '../lib/supabase';

export function useSales() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processSale = async (sellerId, customerId, paymentMethod, items) => {
    try {
      setLoading(true);
      setError(null);
      // RPC process_sale expects items as a JSON array of objects
      const saleId = await db.call('rpc_process_sale', {
        p_seller_id: sellerId,
        p_customer_id: customerId,
        p_payment_method: paymentMethod,
        p_items: items // [{product_id, quantity, unit_price}]
      });
      return saleId;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    processSale,
    loading,
    error
  };
}
