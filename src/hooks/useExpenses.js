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
      // payload: { category_id, description, amount, shared_type, paid_from_register }
      const data = await db.insert('expenses', payload);
      
      const partners = await db.get('partners');
      const raul = partners.find(p => p.name === 'Raúl');
      const nahuel = partners.find(p => p.name === 'Nahuel');
      const negro = partners.find(p => p.name === 'Negro Añais');
      
      let financialMovements = [];
      const amt = payload.amount;
      
      if (payload.shared_type === '50/50') {
         financialMovements.push({ partner_id: raul.id, type: 'expense', amount: -(amt/2), related_id: data[0].id });
         financialMovements.push({ partner_id: nahuel.id, type: 'expense', amount: -(amt/2), related_id: data[0].id });
      } else if (payload.shared_type === '100_raul') {
         if (raul) financialMovements.push({ partner_id: raul.id, type: 'expense', amount: -amt, related_id: data[0].id });
      } else if (payload.shared_type === '100_nahuel') {
         if (nahuel) financialMovements.push({ partner_id: nahuel.id, type: 'expense', amount: -amt, related_id: data[0].id });
      } else if (payload.shared_type === '100_negro') {
         if (negro) financialMovements.push({ partner_id: negro.id, type: 'expense', amount: -amt, related_id: data[0].id });
      } else if (payload.shared_type === '33_all') {
         const split = amt / 3;
         if (raul) financialMovements.push({ partner_id: raul.id, type: 'expense', amount: -split, related_id: data[0].id });
         if (nahuel) financialMovements.push({ partner_id: nahuel.id, type: 'expense', amount: -split, related_id: data[0].id });
         if (negro) financialMovements.push({ partner_id: negro.id, type: 'expense', amount: -split, related_id: data[0].id });
      } else {
         // Fallback old behavior
         if (raul) financialMovements.push({ partner_id: raul.id, type: 'expense', amount: -(amt/2), related_id: data[0].id });
         if (nahuel) financialMovements.push({ partner_id: nahuel.id, type: 'expense', amount: -(amt/2), related_id: data[0].id });
      }

      if (financialMovements.length > 0) {
        await db.insert('financial_movements', financialMovements);
      }

      await fetchExpenses();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const markExpenseAsPaid = async (expenseId) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('expenses')
        .update({ status: 'paid' })
        .eq('id', expenseId);
        
      if (error) throw new Error(error.message);
      
      setExpenses(prev => prev.map(exp => 
        exp.id === expenseId ? { ...exp, status: 'paid' } : exp
      ));
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
    addExpense,
    markExpenseAsPaid
  };
}
