import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';

export function useExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await db.get('expense_categories', { order: { column: 'name', ascending: true } });
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      // Wait to fetch joining categories
      const { supabase } = await import('../lib/supabase');
      const { data, error: fetchErr } = await supabase
        .from('expenses')
        .select('*, expense_categories(name)')
        .order('date', { ascending: false });
        
      if (fetchErr) throw new Error(fetchErr.message);
      setExpenses(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (payload) => {
    try {
      // payload: { category_id, description, amount, shared_type }
      const data = await db.insert('expenses', payload);
      
      // Calculate financial distribution
      // Since we don't have an RPC for expenses yet, we'll do the logic here or in RPC.
      // For real-world we'd do an RPC. Let's do a simple RPC call if we had one, 
      // but we don't have rpc_process_expense. We will just insert to financial_movements directly for simplicity.
      // Wait, `shared_type` might be "50/50".
      
      const partners = await db.get('partners');
      const raul = partners.find(p => p.name === 'Raúl');
      const nahuel = partners.find(p => p.name === 'Nahuel');
      
      let rShare = payload.amount / 2;
      let nShare = payload.amount / 2;
      
      if (payload.shared_type !== '50/50') {
        // Assume percentage string like '60/40' (Raul/Nahuel)
        const parts = payload.shared_type.split('/');
        if (parts.length === 2) {
          rShare = payload.amount * (parseFloat(parts[0]) / 100);
          nShare = payload.amount * (parseFloat(parts[1]) / 100);
        }
      }

      await db.insert('financial_movements', [
        { partner_id: raul.id, type: 'expense', amount: -rShare, related_id: data[0].id },
        { partner_id: nahuel.id, type: 'expense', amount: -nShare, related_id: data[0].id }
      ]);

      await fetchExpenses();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    expenses,
    categories,
    loading,
    error,
    addExpense
  };
}
