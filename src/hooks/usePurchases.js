import { useState } from 'react';
import { db, supabase } from '../lib/supabase';

export function usePurchases() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const processPurchase = async ({ partnerId, supplierId, invoiceNumber, observations, items }) => {
    try {
      setLoading(true);
      setError(null);
      const purchaseId = await db.call('rpc_process_purchase', {
        p_partner_id: partnerId,
        p_supplier_id: supplierId || null,
        p_invoice_number: invoiceNumber || null,
        p_observations: observations || null,
        p_items: items // [{product_id, quantity, unit_price}]
      });
      return purchaseId;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('purchases')
        .select('*, partners(name), suppliers(name)')
        .order('date', { ascending: false });
      if (fetchErr) throw new Error(fetchErr.message);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { processPurchase, fetchPurchases, loading, error };
}

export function usePartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useState(() => {
    db.get('partners').then(data => {
      setPartners(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  });

  return { partners, loading };
}
