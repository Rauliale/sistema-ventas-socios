import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function usePersonalExpenses() {
  const [personalExpenses, setPersonalExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPersonalExpenses();
    }
  }, [user]);

  const fetchPersonalExpenses = async () => {
    try {
      setLoading(true);
      const data = await db.get('personal_expenses', { 
        order: { column: 'created_at', ascending: false } 
      });
      setPersonalExpenses(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addPersonalExpense = async (payload) => {
    if (!user) throw new Error('Usuario no autenticado');
    
    try {
      const expensePayload = {
        ...payload,
        user_id: user.id
      };
      
      const data = await db.insert('personal_expenses', expensePayload);
      await fetchPersonalExpenses();
      return data;
    } catch (err) {
      console.error(err);
      setError(err.message);
      throw err;
    }
  };

  return {
    personalExpenses,
    loading,
    error,
    addPersonalExpense
  };
}
