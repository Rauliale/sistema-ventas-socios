import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSalesReports() {
  const [salesDetails, setSalesDetails] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Available filters
  const [dateFilter, setDateFilter] = useState('month'); // 'today', 'week', 'month', 'all'
  const [partnerFilter, setPartnerFilter] = useState('all'); // 'all', or partner name

  useEffect(() => {
    fetchSalesDetails();
  }, [dateFilter, partnerFilter]);

  const fetchSalesDetails = async () => {
    try {
      setLoading(true);
      
      let query = supabase.from('vw_sales_details').select('*');
      let salesQuery = supabase
        .from('sales')
        .select('id, sale_number, date, payment_method, total_amount, profiles(name)');

      // Date filtering
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate = new Date();

        if (dateFilter === 'today') {
          startDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'week') {
          const day = startDate.getDay(); // 0 is Sunday
          const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
          startDate.setDate(diff);
          startDate.setHours(0, 0, 0, 0);
        } else if (dateFilter === 'month') {
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
        }
        
        let startIso = startDate.toISOString();
        if (startIso < '2026-07-01T00:00:00.000Z') {
          startIso = '2026-07-01T00:00:00.000Z';
        }
        query = query.gte('sale_date', startIso);
        salesQuery = salesQuery.gte('date', startIso);
      } else {
        query = query.gte('sale_date', '2026-07-01T00:00:00.000Z');
        salesQuery = salesQuery.gte('date', '2026-07-01T00:00:00.000Z');
      }

      // Partner filtering
      if (partnerFilter !== 'all') {
        query = query.eq('partner_name', partnerFilter);
      }

      // Order by latest first
      query = query.order('sale_date', { ascending: false });
      salesQuery = salesQuery.order('date', { ascending: false });

      const [detailsRes, salesRes] = await Promise.all([query, salesQuery]);
      
      if (detailsRes.error) throw new Error(detailsRes.error.message);
      if (salesRes.error) throw new Error(salesRes.error.message);
      
      setSalesDetails(detailsRes.data || []);
      setSales((salesRes.data || []).map(s => ({
        ...s,
        seller_name: s.profiles?.name || 'Desconocido'
      })));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    salesDetails,
    sales,
    loading,
    error,
    dateFilter,
    setDateFilter,
    partnerFilter,
    setPartnerFilter,
    refresh: fetchSalesDetails
  };
}
