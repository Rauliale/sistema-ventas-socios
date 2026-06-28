import { useState, useEffect } from 'react';
import { db } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useLoans() {
  const { profile } = useAuth();
  const [installments, setInstallments] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPartners = async () => {
    try {
      const data = await db.get('partners');
      setPartners(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInstallments = async () => {
    try {
      setLoading(true);
      const { supabase } = await import('../lib/supabase');
      // Fetch installments joining loans and partners
      const { data, error: fetchErr } = await supabase
        .from('loan_installments')
        .select('*, loans(*, partners(name))')
        .order('due_date', { ascending: true });
        
      if (fetchErr) throw new Error(fetchErr.message);
      
      let filteredData = data || [];
      if (profile && profile.name) {
        // Filter out loans that do not belong to the logged-in user
        filteredData = filteredData.filter(inst => inst.loans?.partners?.name === profile.name);
      }
      
      setInstallments(filteredData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
    if (profile) {
      fetchInstallments();
    }
  }, [profile]);

  const createLoan = async (payload) => {
    try {
      const { supabase } = await import('../lib/supabase');
      // Payload expects: { p_partner_id, p_description, p_total_amount, p_installments, p_installment_amt, p_first_due_date }
      const { data, error } = await supabase.rpc('rpc_create_loan', payload);
      
      if (error) throw new Error(error.message);
      
      // Refresh list
      await fetchInstallments();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const markInstallmentAsPaid = async (installmentId) => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase
        .from('loan_installments')
        .update({ status: 'paid' })
        .eq('id', installmentId);
        
      if (error) throw new Error(error.message);
      
      // Update local state
      setInstallments(prev => prev.map(inst => 
        inst.id === installmentId ? { ...inst, status: 'paid' } : inst
      ));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    installments,
    partners,
    loading,
    error,
    createLoan,
    markInstallmentAsPaid,
    fetchInstallments
  };
}
