import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useCashRegister() {
  const { user } = useAuth();
  const [activeRegister, setActiveRegister] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkActiveRegister();
  }, []);

  const checkActiveRegister = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('status', 'open')
        .maybeSingle();

      if (err) throw err;
      setActiveRegister(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openRegister = async (initialCash) => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('cash_registers')
        .insert({
          initial_cash: parseFloat(initialCash) || 0,
          opened_by: user?.id,
          status: 'open'
        })
        .select()
        .single();

      if (err) throw err;
      setActiveRegister(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const closeRegister = async (registerId, actualCash) => {
    try {
      setLoading(true);
      // First, fetch the sales during this register
      const reg = activeRegister;
      if (!reg || reg.id !== registerId) throw new Error("Caja no encontrada");

      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('payment_method, total_amount')
        .gte('date', reg.opened_at)
        .lte('date', new Date().toISOString());

      if (salesErr) throw salesErr;

      let totalCashSales = 0;
      let totalTransferSales = 0;

      sales.forEach(sale => {
        const amt = parseFloat(sale.total_amount) || 0;
        if (sale.payment_method === 'Efectivo') {
          totalCashSales += amt;
        } else {
          totalTransferSales += amt;
        }
      });

      const initialCash = parseFloat(reg.initial_cash) || 0;
      const expectedCash = initialCash + totalCashSales;
      const parsedActualCash = parseFloat(actualCash) || 0;
      const difference = parsedActualCash - expectedCash;

      const { data, error: err } = await supabase
        .from('cash_registers')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
          expected_cash: expectedCash,
          actual_cash: parsedActualCash,
          difference: difference,
          transfer_amount: totalTransferSales
        })
        .eq('id', registerId)
        .select()
        .single();

      if (err) throw err;
      setActiveRegister(null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Helper to preview closure stats without actually closing
  const getClosurePreview = async () => {
    if (!activeRegister) return null;
    
    const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('payment_method, total_amount')
        .gte('date', activeRegister.opened_at)
        .lte('date', new Date().toISOString());

    if (salesErr) throw salesErr;

    let totalCashSales = 0;
    let totalTransferSales = 0;

    sales.forEach(sale => {
      const amt = parseFloat(sale.total_amount) || 0;
      if (sale.payment_method === 'Efectivo') {
        totalCashSales += amt;
      } else {
        totalTransferSales += amt;
      }
    });

    const initialCash = parseFloat(activeRegister.initial_cash) || 0;
    const expectedCash = initialCash + totalCashSales;

    return {
      initialCash,
      totalCashSales,
      totalTransferSales,
      expectedCash
    };
  };

  return {
    activeRegister,
    loading,
    error,
    openRegister,
    closeRegister,
    getClosurePreview,
    refresh: checkActiveRegister
  };
}
